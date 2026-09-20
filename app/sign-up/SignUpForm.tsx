"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteToken = searchParams.get("invite");
  const invitedEmail = searchParams.get("email");
  const isInviteFlow = !!inviteToken;

  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ORGANIZER" | "PARTICIPANT">(
    isInviteFlow ? "PARTICIPANT" : "PARTICIPANT"
  );
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 초대 이메일이 있으면 자동 입력
  

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
      role,
    });

    setIsLoading(false);

    if (error) {
      setError(error.message || "회원가입에 실패했어요");
      return;
    }

    // 초대 흐름이면 초대 페이지로, 아니면 메인으로
    if (inviteToken) {
      router.push(`/invite/${inviteToken}`);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">회원가입</h1>

        {isInviteFlow && (
          <p className="mb-6 text-sm text-blue-800">
            초대받은 프로젝트에 참여하려면 계정을 만들어주세요.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 초대 흐름에선 역할 선택 숨김 (자동 참여자) */}
          {!isInviteFlow && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                어떻게 서비스를 이용하실 건가요?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("PARTICIPANT")}
                  className={`rounded border p-3 text-sm ${
                    role === "PARTICIPANT"
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  참여자
                </button>
                <button
                  type="button"
                  onClick={() => setRole("ORGANIZER")}
                  className={`rounded border p-3 text-sm ${
                    role === "ORGANIZER"
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  주최자
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {role === "PARTICIPANT"
                  ? "초대받은 프로젝트의 일정·해설을 보고 참여합니다"
                  : "프로젝트를 기획하고 참여자를 초대합니다"}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-gray-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={!!invitedEmail}
              className="w-full rounded border px-3 py-2 text-gray-900 read-only:bg-gray-100"
            />
            {invitedEmail && (
              <p className="mt-1 text-xs text-gray-500">
                초대받은 이메일 주소예요.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">
              비밀번호 (8자 이상)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded border px-3 py-2 text-gray-900"
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
            className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
          >
            {isLoading ? "처리 중..." : "가입하기"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-700">
          이미 계정이 있어요?{" "}
          <a
            href={
              inviteToken ? `/sign-in?invite=${inviteToken}` : "/sign-in"
            }
            className="text-blue-600 underline"
          >
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}