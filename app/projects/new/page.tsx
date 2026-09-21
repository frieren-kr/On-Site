import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import NewProjectForm from "./NewProjectForm";

export default async function NewProjectPage() {
  const session = await getSession();

  // 로그인 안 했으면 로그인 페이지로
  if (!session) {
    redirect("/sign-in");
  }

  // ORGANIZER가 아니면 대시보드로 (참여자는 이 페이지 접근 불가)
  if (session.user.role !== "ORGANIZER") {
    redirect("/dashboard");
  }


  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:underline"
          >
            ← 대시보드로
          </Link>
        </div>

        <div className="rounded-lg bg-card p-8 shadow">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">
            새 프로젝트
          </h1>

          <NewProjectForm />
        </div>
      </div>
    </div>
  );
}