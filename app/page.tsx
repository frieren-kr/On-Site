import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-md rounded-lg bg-card p-8 shadow">
        <h1 className="mb-2 text-2xl text-black font-bold">OnSite</h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-600">
          OnSite — 장소·일정·동선을 한곳에서 관리하고, 참여자가 모바일에서 바로
          확인할 수 있는 웹 서비스
        </p>

        <div className="space-y-2">
          <a href="/sign-in" className="block rounded bg-accent py-2 text-center text-ink hover:bg-accent-strong">
            로그인
          </a>
          <a href="/sign-up" className="block rounded border py-2 text-center">
            회원가입
          </a>
        </div>
      </div>
    </div>
  );
}
