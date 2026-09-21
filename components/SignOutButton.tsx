"use client";

import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      window.location.href = "/";
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="rounded border border-border px-4 py-2 text-sm text-ink-muted hover:bg-panel disabled:opacity-50"
    >
      {isPending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
