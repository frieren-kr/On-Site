"use client";

import { useState, useTransition } from "react";
import { updateProjectRoute } from "@/app/projects/[id]/actions";

interface RouteControlProps {
  projectId: string;
  canEdit: boolean;
  hasRoute: boolean;
  routeIsStale: boolean;
  distance: number | null;   // 미터
  duration: number | null;   // 밀리초
  siteCount: number;
}

export default function RouteControl({
  projectId,
  canEdit,
  hasRoute,
  routeIsStale,
  distance,
  duration,
  siteCount,
}: RouteControlProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCalculate() {
    setError(null);
    startTransition(async () => {
      const result = await updateProjectRoute({ projectId });
      if (result.error) {
        setError(result.error);
      }
    });
  }

  // 거리/시간 포맷
  const distanceText = distance
    ? distance >= 1000
      ? `${(distance / 1000).toFixed(1)}km`
      : `${distance}m`
    : null;

  const durationText = duration
    ? (() => {
        const totalMinutes = Math.round(duration / 1000 / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      })()
    : null;

  // 장소 2개 미만이면 경로 개념 없음
  if (siteCount < 2) {
    return null;
  }

  return (
    <div className="mb-3 rounded border bg-panel p-3">
      <div className="flex items-center justify-between">
        <div>
          {hasRoute ? (
            <div className="flex gap-4 text-sm">
              <span className="text-gray-900">
                총 이동거리 <strong>{distanceText}</strong>
              </span>
              <span className="text-gray-900">
                예상 소요 <strong>{durationText}</strong>
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-600">
              아직 경로가 계산되지 않았어요
            </span>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleCalculate}
            disabled={isPending}
            className="rounded bg-accent px-3 py-1 text-sm text-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending
              ? "계산 중..."
              : hasRoute
              ? "경로 다시 계산"
              : "차량 경로 계산"}
          </button>
        )}
      </div>

      {/* 낡음 경고 */}
      {canEdit && routeIsStale && hasRoute && (
        <div className="mt-2 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
          장소가 변경됐어요. 경로를 다시 계산해주세요.
        </div>
      )}

      {/* 차량 이동 안내 (참여자용) */}
      {hasRoute && (
        <p className="mt-2 text-xs text-gray-500">
          차량 이동 기준 예상치입니다. 실제 교통상황에 따라 달라질 수 있어요.
        </p>
        
      )}

      {error && (
        <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}