"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setError(error.message || "로그인에 실패했어요");
      return;
    }

    // 초대 흐름이면 초대 페이지로
    if (inviteToken) {
      router.push(`/invite/${inviteToken}`);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-md rounded-lg bg-card p-8 shadow">
        <h1 className="mb-2 text-2xl text-black font-bold">로그인</h1>

        {inviteToken && (
          <p className="mb-4 text-sm text-blue-800">
            로그인 후 초대받은 프로젝트 페이지로 이동해요.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-black font-medium">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-black font-medium">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded bg-accent py-2 text-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-black">
          처음이신가요?{" "}
          <a
            href={
              inviteToken ? `/sign-up?invite=${inviteToken}` : "/sign-up"
            }
            className="text-blue-600 underline"
          >
            회원가입
          </a>
        </p>
      </div>
    </div>
  );
}