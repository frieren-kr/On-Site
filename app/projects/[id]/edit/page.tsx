import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { isProjectOrganizer } from "@/lib/permissions";
import EditProjectForm from "@/components/EditProjectForm";
import Link from "next/link";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;

  // 편집 권한 확인 - organizer만
  const canEdit = await isProjectOrganizer(session.user.id, id);
  if (!canEdit) notFound();

  const project = await prisma.project.findUnique({
    where: { id },
  });
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="mx-auto max-w-2xl px-4">
        <Link
          href={`/projects/${id}`}
          className="mb-4 inline-block text-sm text-gray-600 hover:underline"
        >
          ← 프로젝트로
        </Link>

        <div className="rounded-lg bg-card p-8 shadow">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">
            프로젝트 수정
          </h1>

          <EditProjectForm
            project={{
              id: project.id,
              title: project.title,
              description: project.description,
              startDate: project.startDate,
              endDate: project.endDate,
            }}
          />
        </div>
      </div>
    </div>
  );
}