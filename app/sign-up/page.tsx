import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SignUpForm from "./SignUpForm";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  // 이미 로그인한 사람은 대시보드로. proxy는 쿠키 존재만 보므로 무효화된 세션의 쿠키도
  // 통과시킬 수 있다 → 여기서 auth.api.getSession으로 DB 세션까지 확인해 판단한다.
  // 초대 링크(?invite=)로 온 경우는 다른 계정으로 가입할 수 있도록 그대로 통과.
  const params = await searchParams;
  if (params.invite === undefined && (await getSession())) {
    redirect("/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <p className="text-ink-muted">불러오는 중...</p>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
