"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "@/app/projects/[id]/actions";

interface Site {
  id: string;
  name: string;
}

interface Schedule {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  orderIndex: number;
  siteId: string | null;
  site: { id: string; name: string } | null;
}

interface ScheduleSectionProps {
  projectId: string;
  sites: Site[];
  schedules: Schedule[];
  canEdit: boolean;
  // siteId → 해설 유무. 참여자에게 링크를 걸지 판단하는 데만 쓴다.
  hasDescriptionBySiteId: Map<string, boolean>;
  // 선택된 날짜. 날짜 선택은 상위(ProjectTabs)가 소유하고, 여기선 이 날짜만 보여준다.
  activeDate: string | null;
}

// Date → "YYYY-MM-DD" (로컬 기준. UTC 변환 시 날짜 밀림 방지)
function toDateKey(date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 날짜별 그룹핑 + 각 날짜 안에서 시간순 정렬(방어적)
function groupByDate(schedules: Schedule[]): Record<string, Schedule[]> {
  const result: Record<string, Schedule[]> = {};
  for (const s of schedules) {
    const key = toDateKey(s.date);
    if (!result[key]) result[key] = [];
    result[key].push(s);
  }
  for (const key of Object.keys(result)) {
    result[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return result;
}

export default function ScheduleSection({
  projectId,
  sites,
  schedules,
  canEdit,
  hasDescriptionBySiteId,
  activeDate,
}: ScheduleSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = groupByDate(schedules);
  const activeSchedules = activeDate ? grouped[activeDate] ?? [] : [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          일정 ({schedules.length})
        </h2>
        {canEdit && !isAdding && !editingId && (
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setError(null);
            }}
            className="rounded bg-black px-3 py-1 text-sm text-white"
          >
            + 일정 추가
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 추가 폼 - 현재 선택된 날짜를 기본값으로 */}
      {isAdding && canEdit && (
        <ScheduleForm
          projectId={projectId}
          sites={sites}
          mode="create"
          defaultDate={activeDate ?? ""}
          onDone={() => setIsAdding(false)}
          onError={setError}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      {schedules.length === 0 ? (
        <p className="text-sm text-gray-600">
          {canEdit
            ? "일정을 추가하면 여기에 표시돼요."
            : "아직 등록된 일정이 없어요."}
        </p>
      ) : (
        <>
          {/* 선택된 날짜(activeDate)의 일정만 */}
          <ol className="space-y-1">
            {activeSchedules.map((schedule) => {
              const isEditingThis = editingId === schedule.id;

              if (isEditingThis) {
                return (
                  <li key={schedule.id}>
                    <ScheduleForm
                      projectId={projectId}
                      sites={sites}
                      mode="edit"
                      initialData={{
                        scheduleId: schedule.id,
                        title: schedule.title,
                        date: toDateKey(schedule.date),
                        startTime: schedule.startTime,
                        endTime: schedule.endTime,
                        siteId: schedule.siteId || "",
                      }}
                      onDone={() => setEditingId(null)}
                      onError={setError}
                      isPending={isPending}
                      startTransition={startTransition}
                    />
                  </li>
                );
              }

              return (
                <li
                  key={schedule.id}
                  className="flex items-center gap-3 rounded border border-gray-200 p-3"
                >
                  <div className="w-24 shrink-0 text-xs text-gray-500">
                    {schedule.startTime} – {schedule.endTime}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {schedule.title}
                    </p>
                    {/* organizer는 항상 링크, 참여자는 해설이 있을 때만 */}
                    {schedule.site &&
                      (canEdit ||
                      hasDescriptionBySiteId.get(schedule.site.id) ? (
                        <Link
                          href={`/projects/${projectId}/sites/${schedule.site.id}`}
                          className="text-xs text-blue-600 underline hover:text-blue-800"
                        >
                          → {schedule.site.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-900">
                          → {schedule.site.name}
                        </span>
                      ))}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(schedule.id);
                          setError(null);
                        }}
                        disabled={isPending || isAdding}
                        className="rounded border px-2 py-1 text-xs text-gray-700 disabled:opacity-30"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !confirm(`"${schedule.title}" 일정을 삭제할까요?`)
                          )
                            return;
                          setError(null);
                          startTransition(async () => {
                            const result = await deleteSchedule({
                              scheduleId: schedule.id,
                              projectId,
                            });
                            if (result.error) setError(result.error);
                          });
                        }}
                        disabled={isPending}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-30"
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
      )}
    </div>
  );
}

// ── 폼 (create/edit 공용) ──
interface ScheduleFormProps {
  projectId: string;
  sites: Site[];
  mode: "create" | "edit";
  initialData?: {
    scheduleId: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    siteId: string;
  };
  defaultDate?: string;
  onDone: () => void;
  onError: (msg: string | null) => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}

function ScheduleForm({
  projectId,
  sites,
  mode,
  initialData,
  defaultDate,
  onDone,
  onError,
  isPending,
  startTransition,
}: ScheduleFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [date, setDate] = useState(initialData?.date || defaultDate || "");
  const [startTime, setStartTime] = useState(initialData?.startTime || "");
  const [endTime, setEndTime] = useState(initialData?.endTime || "");
  const [siteId, setSiteId] = useState(initialData?.siteId || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);

    startTransition(async () => {
      let result;
      if (mode === "create") {
        result = await createSchedule({
          projectId,
          title: title.trim(),
          date,
          startTime,
          endTime,
          siteId: siteId || undefined,
        });
      } else {
        if (!initialData) return;
        result = await updateSchedule({
          scheduleId: initialData.scheduleId,
          projectId,
          title: title.trim(),
          date,
          startTime,
          endTime,
          siteId: siteId || undefined,
        });
      }

      if (result.error) {
        onError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 space-y-3 rounded border border-gray-300 bg-gray-50 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-900">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={100}
          placeholder="예: 근정전 관람, 점심 식사, 버스 이동"
          className="w-full rounded border px-3 py-2 text-sm text-gray-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-900">
            날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded border px-2 py-2 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-900">
            시작 <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full rounded border px-2 py-2 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-900">
            종료 <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="w-full rounded border px-2 py-2 text-sm text-gray-900"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-900">
          연결할 장소 (선택)
        </label>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm text-gray-900"
        >
          <option value="">장소 없음 (자유 일정)</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="rounded border px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}