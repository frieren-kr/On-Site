"use client";

import { useState, useTransition, useOptimistic } from "react";
import { deleteSite, reorderSite } from "@/app/projects/[id]/actions";
import Link from "next/link";

interface Site {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  orderIndex: number;
  hasDescription: boolean; // 해설이 있어야 참여자에게 링크를 건다
}

interface SiteListProps {
  sites: Site[];
  projectId: string;
  canEdit: boolean;
}

export default function SiteList({ sites, projectId, canEdit }: SiteListProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // 순서 변경 낙관적 상태. 서버가 revalidate로 새 sites를 내려주면 자동으로 이 값에 다시 맞춰지고,
  // 서버 액션이 에러/실패로 끝나면 transition 종료와 함께 sites(원래 순서)로 되돌아간다.
  const [optimisticSites, applyOptimisticReorder] = useOptimistic(
    sites,
    (current: Site[], action: { siteId: string; direction: "up" | "down" }) => {
      const index = current.findIndex((s) => s.id === action.siteId);
      if (index === -1) return current;
      const swapWith = action.direction === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= current.length) return current;

      const next = [...current];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    }
  );

  function handleDelete(siteId: string, name: string) {
    if (!confirm(`"${name}" 장소를 삭제할까요?`)) return;

    setError(null);
    setPendingId(siteId);
    startTransition(async () => {
      const result = await deleteSite({ siteId, projectId });
      if (result.error) setError(result.error);
      setPendingId(null);
    });
  }

  function handleReorder(siteId: string, direction: "up" | "down") {
    setError(null);
    setPendingId(siteId);
    startTransition(async () => {
      // 화면을 먼저 바꾸고(낙관적), 서버 응답은 뒤따라 확인한다.
      applyOptimisticReorder({ siteId, direction });
      const result = await reorderSite({ siteId, projectId, direction });
      // 실패 시 낙관적 순서는 transition 종료와 함께 저절로 되돌아가므로,
      // 에러 메시지만 띄워서 사용자가 되돌려졌다는 걸 분명히 알게 한다.
      if (result.error) setError(result.error);
      setPendingId(null);
    });
  }

  if (sites.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        {canEdit
          ? "위에서 첫 장소를 검색해 추가해보세요."
          : "아직 등록된 장소가 없어요."}
      </p>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ol className="space-y-2">
        {optimisticSites.map((site, index) => {
          const isFirst = index === 0;
          const isLast = index === optimisticSites.length - 1;
          const isThisPending = pendingId === site.id && isPending;

          // 장소 정보 블록 (이름 + 주소 + 좌표) — 참여자 화면용.
          // 해설이 있을 때만 이름을 링크처럼 보이게 한다.
          const siteInfo = (
            <>
              <h3
                className={
                  site.hasDescription
                    ? "font-medium text-link underline"
                    : "font-medium text-gray-900"
                }
              >
                {site.name}
              </h3>
              {site.address && (
                <p className="text-xs text-gray-500">{site.address}</p>
              )}
              <p className="text-xs text-gray-400">
                {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
              </p>
            </>
          );

          return (
            <li
              key={site.id}
              className="flex items-start gap-3 rounded border p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs text-white">
                {index + 1}
              </span>

              {/* 조직자: 이름만 링크 / 참여자: 정보 블록 전체 링크 */}
              {canEdit ? (
                <div className="flex-1">
                  {/* organizer는 해설 유무와 무관하게 항상 링크 */}
                  <Link
                    href={`/projects/${projectId}/sites/${site.id}`}
                    className="font-medium text-link underline hover:text-blue-800"
                  >
                    {site.name}
                  </Link>
                  {site.address && (
                    <p className="text-xs text-gray-500">{site.address}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
                  </p>
                </div>
              ) : site.hasDescription ? (
                <Link
                  href={`/projects/${projectId}/sites/${site.id}`}
                  className="flex-1 rounded hover:bg-gray-50"
                >
                  {siteInfo}
                </Link>
              ) : (
                // 해설이 없으면 클릭할 게 없으니 링크도 hover도 주지 않는다
                <div className="flex-1 rounded">{siteInfo}</div>
              )}

              {/* 편집 버튼 (조직자만) */}
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleReorder(site.id, "up")}
                    disabled={isFirst || isPending}
                    className="rounded border px-2 py-1 text-xs text-gray-700 disabled:opacity-30"
                    title="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(site.id, "down")}
                    disabled={isLast || isPending}
                    className="rounded border px-2 py-1 text-xs text-gray-700 disabled:opacity-30"
                    title="아래로"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(site.id, site.name)}
                    disabled={isThisPending}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-30"
                    title="삭제"
                  >
                    삭제
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}