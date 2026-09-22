"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SiteList from "./SiteList";
import ScheduleSection from "./ScheduleSection";
import RouteView from "./RouteView";
import SiteRegisterMap from "./SiteRegisterMap";

interface RouteStop {
  siteId: string;
  name: string;
  latitude: number;
  longitude: number;
  date: string; // "YYYY-MM-DD"
  hasDescription: boolean;
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

interface ScheduleData {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  orderIndex: number;
  siteId: string | null;
  site: { id: string; name: string } | null;
}

interface SiteData {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  orderIndex: number;
  hasDescription: boolean;
}

interface ProjectTabsProps {
  projectId: string;
  canEdit: boolean;
  sites: SiteData[]; // 장소 탭(SiteList)용 — 전체 필드
  scheduleSites: { id: string; name: string }[]; // 일정 폼의 장소 선택용
  schedules: ScheduleData[];
  hasDescriptionBySiteId: Map<string, boolean>;
  stops: RouteStop[];
  routeData: Record<string, DateRoute> | null;
  routeIsStale: boolean;
}

// Date → "YYYY-MM-DD" (로컬 기준. UTC 변환 시 날짜 밀림 방지)
function toDateKey(date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// "YYYY-MM-DD" → "8월 17일 (월)"
function formatDateLabel(dateKey: string): string {
  return new Date(dateKey).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

type TopTab = "date" | "site";
type SubTab = "route" | "schedule";

export default function ProjectTabs({
  projectId,
  canEdit,
  sites,
  scheduleSites,
  schedules,
  hasDescriptionBySiteId,
  stops,
  routeData,
  routeIsStale,
}: ProjectTabsProps) {
  // 날짜 목록은 일정에서 파생 (일정이 있는 날들)
  const dateKeys = useMemo(
    () => Array.from(new Set(schedules.map((s) => toDateKey(s.date)))).sort(),
    [schedules]
  );

  const [topTab, setTopTab] = useState<TopTab>("date");
  const [subTab, setSubTab] = useState<SubTab>("route");
  // 초기값만: 오늘(dateKeys와 동일한 로컬 기준 포맷)이 목록에 있으면 오늘, 없으면 첫 날짜.
  // 사용자가 탭을 누른 뒤에는 selectDate/effectiveDate 로직이 그대로 담당한다.
  const [activeDate, setActiveDate] = useState<string | null>(() => {
    const today = toDateKey(new Date());
    return dateKeys.includes(today) ? today : dateKeys[0] ?? null;
  });

  // activeDate가 사라진 날짜(삭제 등)를 가리키면 첫 날짜로 보정
  const effectiveDate =
    activeDate && dateKeys.includes(activeDate)
      ? activeDate
      : dateKeys[0] ?? null;

  // 날짜 탭 가로 스크롤: 양끝 페이드 표시 여부 + 선택 탭 자동 노출
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftFade(scrollLeft > 1);
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  // 마운트/영역 크기 변화/날짜 목록 변화 시 페이드 갱신
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateFades, dateKeys]);

  // 선택된 날짜 탭이 화면 밖이면 가로로만 스크롤해서 보이게 (첫 진입 시 오늘 탭 포함)
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [effectiveDate]);

  // 날짜 탭 클릭: 날짜 모드로. 날짜가 실제로 바뀔 때만 하위 탭을 동선으로 리셋한다.
  // (장소 탭 갔다가 같은 날짜로 돌아오면 보던 하위 탭을 그대로 유지)
  function selectDate(dateKey: string) {
    setTopTab("date");
    if (dateKey !== effectiveDate) {
      setActiveDate(dateKey);
      setSubTab("route");
    }
  }

  const topTabClass = (active: boolean) =>
    `whitespace-nowrap border-b-2 px-4 py-3 text-base font-semibold ${
      active
        ? "border-accent text-ink"
        : "border-transparent text-ink-muted"
    }`;

  const subTabClass = (active: boolean) =>
    `border-b-2 py-2 text-sm ${
      active
        ? "border-accent font-medium text-ink"
        : "border-transparent text-ink-muted hover:text-ink-muted"
    }`;

  return (
    <div className="mb-6 rounded-lg bg-card shadow">
      {/* 상단 탭 바: 왼쪽 날짜(가로 스크롤) / 오른쪽 장소(고정) — 서로 다른 축 */}
      <div className="flex items-stretch border-b border-border">
        <div className="relative min-w-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={updateFades}
            className="overflow-x-auto"
          >
            <div className="flex">
              {dateKeys.length === 0 ? (
                <span className="whitespace-nowrap px-4 py-3 text-base font-semibold text-ink-faint">
                  날짜 없음
                </span>
              ) : (
                dateKeys.map((dateKey) => (
                  <button
                    key={dateKey}
                    ref={dateKey === effectiveDate ? activeTabRef : null}
                    type="button"
                    onClick={() => selectDate(dateKey)}
                    className={topTabClass(
                      topTab === "date" && dateKey === effectiveDate
                    )}
                  >
                    {formatDateLabel(dateKey)}
                  </button>
                ))
              )}
            </div>
          </div>
          {/* 스크롤 끝에 더 볼 탭이 있을 때만 페이드 (클릭 방해 금지) */}
          {showLeftFade && (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-ink/20 to-transparent" />
          )}
          {showRightFade && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ink/20 to-transparent" />
          )}
        </div>

        {/* 구분선(border-l) + 스크롤 영역 밖 고정 */}
        <div className="flex shrink-0 border-l border-border">
          <button
            type="button"
            onClick={() => setTopTab("site")}
            className={topTabClass(topTab === "site")}
          >
            장소
          </button>
        </div>
      </div>

      {/* 하위 탭 바: 날짜 모드일 때만, 상위보다 작게 */}
      {topTab === "date" && (
        <div className="flex gap-4 border-b border-border px-4">
          <button
            type="button"
            onClick={() => setSubTab("route")}
            className={subTabClass(subTab === "route")}
          >
            동선
          </button>
          <button
            type="button"
            onClick={() => setSubTab("schedule")}
            className={subTabClass(subTab === "schedule")}
          >
            일정
          </button>
        </div>
      )}

      {/* 패널 */}
      <div className="p-6">
        {topTab === "site" ? (
          <>
            {/* organizer는 장소 추가 UI를 목록 위에 먼저 본다 */}
            {canEdit && (
              <div className="mb-6">
                <h2 className="mb-4 text-lg font-semibold text-ink">
                  장소 추가
                </h2>
                <SiteRegisterMap projectId={projectId} sites={sites} />
              </div>
            )}

            <div className="mb-4">
              <h2 className="text-lg font-semibold text-ink">
                장소 목록 ({sites.length})
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                장소 이름을 눌러 해설을 확인하세요.
              </p>
            </div>
            <SiteList sites={sites} projectId={projectId} canEdit={canEdit} />
          </>
        ) : subTab === "route" ? (
          <RouteView
            projectId={projectId}
            canEdit={canEdit}
            activeDate={effectiveDate}
            stops={stops}
            routeData={routeData}
            routeIsStale={routeIsStale}
          />
        ) : (
          <ScheduleSection
            projectId={projectId}
            sites={scheduleSites}
            schedules={schedules}
            canEdit={canEdit}
            hasDescriptionBySiteId={hasDescriptionBySiteId}
            activeDate={effectiveDate}
          />
        )}
      </div>
    </div>
  );
}
