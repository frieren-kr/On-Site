"use client";

import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";

interface DeleteImpact {
  ownedProjectCount: number;
  affectedMembers: number;
  joinedCount: number;
  ownedProjects: Array<{
    id: string;
    title: string;
    memberCount: number;
  }>;
  // 이 유저가 유일한 주최자라 탈퇴를 막는 프로젝트들 (있으면 탈퇴 불가)
  blockingProjects: Array<{ id: string; title: string }>;
}

export default function DeleteAccountSection({
  impact,
}: {
  impact: DeleteImpact;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasImpact = impact.ownedProjectCount > 0;
  const blocked = impact.blockingProjects.length > 0;

  // 유일한 주최자라 탈퇴가 막히는 경우의 경고 (초기/확인 화면 공통)
  const blockingNotice = (
    <div className="rounded border border-warning-border bg-warning-tint p-4 text-sm text-warning-ink">
      <p className="mb-2 font-semibold">
        아직 탈퇴할 수 없어요. 다음 프로젝트의 유일한 주최자예요:
      </p>
      <ul className="mb-2 space-y-1">
        {impact.blockingProjects.map((p) => (
          <li key={p.id}>• {p.title}</li>
        ))}
      </ul>
      <p>
        다른 사람을 주최자로 초대하거나 해당 프로젝트를 삭제해 먼저 정리한 뒤 다시
        시도하세요.
      </p>
    </div>
  );

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.deleteUser();

      if (error) {
        setError(error.message || "탈퇴에 실패했어요");
        return;
      }

      // 탈퇴 성공 → 홈으로
      window.location.href = "/";
    });
  }

  if (!showConfirm) {
    return (
      <div className="space-y-4">
        {blocked && blockingNotice}
        <p className="text-sm text-ink-muted">
          탈퇴하면 계정과 관련된 모든 데이터가 삭제되며 복구할 수 없어요.
        </p>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={blocked}
          className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          회원 탈퇴 진행
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 삭제 영향 요약 */}
      <div className="rounded bg-red-50 p-4 text-sm">
        <p className="mb-2 font-semibold text-red-800">
          탈퇴하면 다음 데이터가 영구 삭제됩니다:
        </p>
        <ul className="space-y-1 text-red-700">
          <li>• 회원님의 계정 정보</li>
          {impact.ownedProjectCount > 0 && (
            <li>
              • 회원님이 만든 프로젝트 {impact.ownedProjectCount}개
            </li>
          )}
          {impact.affectedMembers > 0 && (
            <li>
              • 위 프로젝트에 참여 중인 다른 참여자 {impact.affectedMembers}명의
              참여 정보
            </li>
          )}
          {impact.joinedCount > 0 && (
            <li>• 회원님이 참여 중인 프로젝트 {impact.joinedCount}건의 참여 기록</li>
          )}
        </ul>
      </div>

      {/* 삭제될 프로젝트 목록 */}
      {hasImpact && (
        <div className="rounded border p-3 text-sm">
          <p className="mb-2 font-medium text-ink">
            삭제될 프로젝트:
          </p>
          <ul className="space-y-1 text-ink-muted">
            {impact.ownedProjects.map((p) => (
              <li key={p.id}>
                • {p.title} (참여자 {p.memberCount}명)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 확인 텍스트 입력 */}
      <div>
        <label className="mb-1 block text-sm text-ink-muted">
          탈퇴하려면 아래에 <strong>탈퇴합니다</strong>를 입력하세요.
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="탈퇴합니다"
          className="w-full rounded border px-3 py-2 text-sm text-ink"
        />
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setShowConfirm(false);
            setConfirmText("");
            setError(null);
          }}
          disabled={isPending}
          className="rounded border px-4 py-2 text-sm text-ink-muted disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || blocked || confirmText !== "탈퇴합니다"}
          className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "탈퇴 처리 중..." : "영구 탈퇴"}
        </button>
      </div>
    </div>
  );
}