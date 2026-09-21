import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { canAccessProject, isProjectOrganizer } from "@/lib/permissions";
import SiteEditor from "@/components/SiteEditor";
import Link from "next/link";

export default async function SitePage({
  params,
}: {
  params: Promise<{ id: string; siteId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id: projectId, siteId } = await params;

  // 프로젝트 접근 권한
  const hasAccess = await canAccessProject(session.user.id, projectId);
  if (!hasAccess) notFound();

  // 장소 조회 + 프로젝트 소속 확인 (IDOR 방어)
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      project: {
        select: { title: true, id: true },
      },
    },
  });

  if (!site || site.projectId !== projectId) notFound();

  // 편집 권한
  const canEdit = await isProjectOrganizer(session.user.id, projectId);

  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="mx-auto max-w-3xl px-4">
        <Link
          href={`/projects/${projectId}`}
          className="mb-4 inline-block text-sm text-ink-muted hover:underline"
        >
          ← {site.project.title}
        </Link>

        <SiteEditor
          site={{
            id: site.id,
            projectId: site.projectId,
            name: site.name,
            description: site.description,
            address: site.address,
            latitude: site.latitude,
            longitude: site.longitude,
          }}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}