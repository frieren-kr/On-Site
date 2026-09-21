"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/app/invite/[token]/actions";

export default function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation({ token });
      if (result.error) {
        setError(result.error);
        return;
      }
      // 참가 성공 → 프로젝트로 이동
      router.push(`/projects/${result.projectId}`);
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="w-full rounded bg-accent py-2 text-sm text-ink hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "참여 중..." : "이 프로젝트에 참여하기"}
      </button>
    </div>
  );
}