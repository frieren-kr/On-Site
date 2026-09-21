"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProject, deleteProject } from "@/app/projects/actions";

interface Project {
  id: string;
  title: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

// Date → YYYY-MM-DD 문자열 변환 (input type="date" 기본값용)
function dateToInputValue(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function EditProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [startDate, setStartDate] = useState(dateToInputValue(project.startDate));
  const [endDate, setEndDate] = useState(dateToInputValue(project.endDate));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateProject({
        projectId: project.id,
        title,
        description: description || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push(`/projects/${project.id}`);
    });
  }

  function handleDelete() {
    const confirmed = confirm(
      `"${project.title}" 프로젝트를 삭제할까요?\n장소·일정·초대 정보도 모두 삭제되고 복구할 수 없어요.`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteProject({ projectId: project.id });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push("/dashboard");
    });
  }

  return (
    <form onSubmit={handleUpdate} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">
          프로젝트 제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={100}
          className="w-full rounded border px-3 py-2 text-gray-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">
          프로젝트 개요
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full rounded border px-3 py-2 text-gray-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">
            시작일
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border px-3 py-2 text-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">
            종료일
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded border px-3 py-2 text-gray-900"
          />
        </div>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-50"
        >
          프로젝트 삭제
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/projects/${project.id}`)}
            className="rounded border px-4 py-2 text-sm text-gray-700"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-accent px-4 py-2 text-sm text-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </form>
  );
}