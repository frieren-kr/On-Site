"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProject } from "../actions";

export default function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          프로젝트 제목 <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          type="text"
          required
          maxLength={100}
          placeholder="예: 2026 봄 경주 워크숍"
          className="w-full rounded border px-3 py-2 text-ink"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          프로젝트 개요
        </label>
        <textarea
          name="description"
          rows={4}
          maxLength={1000}
          placeholder="프로젝트 목적, 주제 등을 간단히 적어주세요"
          className="w-full rounded border px-3 py-2 text-ink"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            시작일
          </label>
          <input
            name="startDate"
            type="date"
            className="w-full rounded border px-3 py-2 text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            종료일
          </label>
          <input
            name="endDate"
            type="date"
            className="w-full rounded border px-3 py-2 text-ink"
          />
        </div>
      </div>

      <div className="rounded border border-border bg-panel p-3 text-sm text-ink-muted">
        프로젝트를 만든 뒤 장소·일정·해설을 추가하고 참여자를 초대할 수 있어요.
      </div>

      <div className="flex gap-2 pt-2">
        <Link
          href="/dashboard"
          className="rounded border px-4 py-2 text-sm text-ink-muted"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm text-ink hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "만드는 중..." : "프로젝트 만들기"}
        </button>
      </div>
    </form>
  );
}
