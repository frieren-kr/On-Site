"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import ProjectMap from "./ProjectMap";
import { distanceInMeters, type Coords } from "@/lib/geolocation";
import { updateProjectRoute } from "@/app/projects/[id]/actions";

// 이 반경 안의 장소를 "근처"로 본다
const NEARBY_RADIUS_M = 700;

interface RouteStop {
  siteId: string;
  name: string;
  latitude: number;
  longitude: number;
  date: string; // "YYYY-MM-DD"
  hasDescription: boolean; // 해설이 있어야 배너에서 링크를 건다
}

interface DateRoute {
  path: number[][];
  distance: number;
  duration: number;
}

interface RouteViewProps {
  projectId: string;
  canEdit: boolean;
  activeDate: string | null;                 // 날짜 선택은 상위(ProjectTabs)가 소유·보정해서 내려준다
  stops: RouteStop[];                        // 전체(날짜 무관) 일정순 장소
  routeData: Record<string, DateRoute> | null; // 날짜별 경로
  routeIsStale: boolean;
}

interface RouteLeg {
  distance: number;
  duration: number;
  fromName: string;
  toName: string;
}

interface DateRoute {
  path: number[][];
  distance: number;
  duration: number;
  legs: RouteLeg[];
}

export default function RouteView({
  projectId,
  canEdit,
  activeDate,
  stops,
  routeData,
  routeIsStale,
}: RouteViewProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // "내 위치" 버튼으로 잡은 좌표. ProjectMap이 onLocate로 알려준다.
  const [myCoords, setMyCoords] = useState<Coords | null>(null);

  // useMemo 필수: 매 렌더 새 배열을 만들면 ProjectMap의 effect가 재실행돼
  // 지도가 통째로 다시 만들어지고, 찍어둔 내 위치 마커가 사라진다.
  // activeDate는 상위에서 이미 보정된 값이라 여기선 그대로 필터에만 쓴다.
  const activeStops = useMemo(
    () => (activeDate ? stops.filter((s) => s.date === activeDate) : []),
    [stops, activeDate]
  );
  const mapStops = useMemo(
    () =>
      activeStops.map((s) => ({
        siteId: s.siteId,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
      })),
    [activeStops]
  );

  // 현재 위치에서 NEARBY_RADIUS_M 안에 있는 당일 장소 (가까운 순)
  const nearbyStops = useMemo(() => {
    if (!myCoords) return [];
    return activeStops
      .map((s) => ({
        ...s,
        distance: distanceInMeters(
          myCoords.latitude,
          myCoords.longitude,
          s.latitude,
          s.longitude
        ),
      }))
      .filter((s) => s.distance <= NEARBY_RADIUS_M)
      .sort((a, b) => a.distance - b.distance);
  }, [myCoords, activeStops]);

  const activeRoute =
    activeDate && routeData ? routeData[activeDate] ?? null : null;

  function handleCalculate() {
    setError(null);
    startTransition(async () => {
      const result = await updateProjectRoute({ projectId });
      if (result.error) setError(result.error);
    });
  }

  function fmtDistance(m: number) {
    return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
  }
  function fmtDuration(ms: number) {
    const min = Math.round(ms / 60000);
    const h = Math.floor(min / 60);
    const r = min % 60;
    return h > 0 ? `${h}시간 ${r}분` : `${r}분`;
  }

  if (stops.length === 0) {
    return (
      <div className="rounded border bg-gray-50 p-6 text-center text-sm text-gray-500">
        장소가 연결된 일정이 없어요. 일정에 장소를 연결하면 동선이
        표시됩니다.
      </div>
    );
  }

  return (
    <div>
      {/* 경로 계산 버튼 + 낡음 안내 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {routeData
            ? "날짜별 이동 경로입니다. 차량 이동 기준 예상치입니다."
            : "아직 경로가 계산되지 않았어요."}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleCalculate}
            disabled={isPending}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {isPending
              ? "계산 중..."
              : routeData
              ? "경로 다시 계산"
              : "차량 경로 계산"}
          </button>
        )}
      </div>

      {canEdit && routeIsStale && routeData && (
        <div className="mb-3 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
          일정이나 장소가 변경됐어요. 경로를 다시 계산해주세요.
        </div>
      )}

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 근접 배너: 위치를 잡기 전(myCoords 없음)에는 아무것도 보이지 않는다 */}
      {myCoords &&
        (nearbyStops.length > 0 ? (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="mb-2 text-sm font-medium text-blue-900">
              📍 현재 위치에서 {NEARBY_RADIUS_M}m 안에 장소{" "}
              {nearbyStops.length}곳이 있어요
            </p>
            <ul className="space-y-1">
              {nearbyStops.map((s) => (
                <li
                  key={s.siteId}
                  className="flex items-center justify-between text-sm text-blue-900"
                >
                  {/* organizer는 항상 링크, 참여자는 해설이 있을 때만 */}
                  {canEdit || s.hasDescription ? (
                    <Link
                      href={`/projects/${projectId}/sites/${s.siteId}`}
                      className="flex-1 truncate text-blue-600 underline hover:text-blue-800"
                    >
                      {s.name}
                    </Link>
                  ) : (
                    <span className="flex-1 truncate text-gray-900">
                      {s.name}
                    </span>
                  )}
                  <span className="ml-2 shrink-0 font-medium text-blue-700">
                    {Math.round(s.distance)}m
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            📍 현재 위치에서 {NEARBY_RADIUS_M}m 근처에 장소가 없어요
          </div>
        ))}

      {/* 선택 날짜의 거리·시간 */}
      {activeRoute && (
        <div className="mb-3 flex gap-4 text-sm">
          <span className="text-gray-900">
            이동거리 <strong>{fmtDistance(activeRoute.distance)}</strong>
          </span>
          <span className="text-gray-900">
            예상 소요 <strong>{fmtDuration(activeRoute.duration)}</strong>
          </span>
        </div>
      )}
      {activeRoute && activeRoute.legs && activeRoute.legs.length > 0 && (
        <div className="mb-3 rounded border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-700">구간별 이동</p>
          <ul className="space-y-1">
            {activeRoute.legs.map((leg, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-xs text-gray-600"
              >
                <span className="flex-1 truncate">
                  {i + 1}.{leg.fromName} → {leg.toName}
                </span>
                <span className="ml-2 shrink-0 text-gray-500">
                  {fmtDistance(leg.distance)} · {fmtDuration(leg.duration)}
                </span>
               </li>
            ))}
          </ul>
        </div>
      )}

      {/* 지도 */}
      <ProjectMap
        stops={mapStops}
        routePath={activeRoute?.path ?? null}
        height="400px"
        onLocate={setMyCoords}
        myCoords={myCoords}
      />

      {activeRoute && (
        <p className="mt-2 text-xs text-gray-500">
          차량 이동 기준 예상치입니다. 실제 교통상황에 따라 달라질 수 있어요.
        </p>
      )}
    </div>
  );
}