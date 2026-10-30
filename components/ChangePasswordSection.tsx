"use client";

import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";

// lib/auth.ts의 emailAndPassword.minPasswordLength와 동일 (회원가입 폼과 같은 규칙)
const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mismatch = confirmPassword !== "" && newPassword !== confirmPassword;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호와 확인이 일치하지 않아요");
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        // 비밀번호를 바꾸는 이유가 유출 의심일 수 있으므로 다른 기기(모바일 앱 토큰 포함)의
        // 세션을 전부 무효화한다. 지금 이 브라우저는 서버가 새 세션을 발급해 로그인 유지된다.
        revokeOtherSessions: true,
      });

      if (error) {
        if (error.code === "INVALID_PASSWORD") {
          setError("현재 비밀번호가 맞지 않아요");
        } else if (error.code === "PASSWORD_TOO_SHORT") {
          setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요`);
        } else {
          setError(error.message || "비밀번호 변경에 실패했어요");
        }
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          현재 비밀번호
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded border px-3 py-2 text-ink"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          새 비밀번호 ({MIN_PASSWORD_LENGTH}자 이상)
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className="w-full rounded border px-3 py-2 text-ink"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          새 비밀번호 확인
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full rounded border px-3 py-2 text-ink"
        />
        {mismatch && (
          <p className="mt-1 text-xs text-red-600">
            새 비밀번호와 일치하지 않아요
          </p>
        )}
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded bg-green-50 p-3 text-sm text-green-800">
          비밀번호가 변경되었어요. 다른 기기에서는 다시 로그인해야 해요.
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || mismatch}
        className="rounded bg-accent px-4 py-2 text-sm text-ink hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
