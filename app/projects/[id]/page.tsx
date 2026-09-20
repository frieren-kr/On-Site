import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { canAccessProject, isProjectOrganizer } from "@/lib/permissions";
import Link from "next/link";
import InvitationManager from "@/components/InvitationManager";
import ProjectTabs from "@/components/ProjectTabs";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;

  const hasAccess = await canAccessProject(session.user.id, id);
  if (!hasAccess) notFound();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      sites: {
        orderBy: { orderIndex: "asc" },
      },
      schedules: {
        orderBy: [{ date: "asc" }, { startTime: "asc" }, { orderIndex: "asc" }],
        include: {
          site: { select: { id: true, name: true, latitude: true, longitude: true } },
        },
      },
      invitations: {
        orderBy: { createdAt: "desc" },
      },
      members: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      },
      organizer: {
        select: { name: true },
      },
    },
  });

  if (!project) notFound();

  const canEdit = await isProjectOrganizer(session.user.id, id);

  // 경로가 최신인지 판단
  // 장소 중 가장 최근에 생성/수정된 시각 vs 경로 계산 시각 비교
  const latestSiteChange = project.sites.reduce<Date | null>((latest, site) => {
    const siteTime = new Date(site.createdAt);
    if (!latest || siteTime > latest) return siteTime;
    return latest;
  }, null);

  const routeIsStale =
    project.sites.length >= 2 &&
    (!project.routeUpdatedAt ||
      (latestSiteChange !== null &&
        new Date(project.routeUpdatedAt) < latestSiteChange));

  // 해설이 실제로 있는 장소 (null·빈문자·공백만 = 없음).
  // schedules.site select에는 description이 없어서, 이미 전부 불러온
  // project.sites에서 계산해 두고 siteId로 찾아 쓴다.
  const hasDescriptionBySiteId = new Map(
    project.sites.map((site) => [
      site.id,
      site.description != null && site.description.trim() !== "",
    ])
  );

  // 날짜 표시 헬퍼
  const formatDate = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  // 장소 연결된 일정만, 날짜·시간순으로 → 동선 탭용 stops
  const stops = project.schedules
    .filter((s) => s.site !== null)
    .map((s) => {
      const d = new Date(s.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        siteId: s.site!.id,
        name: s.site!.name,
        latitude: s.site!.latitude,
        longitude: s.site!.longitude,
        date: dateKey,
        hasDescription: hasDescriptionBySiteId.get(s.site!.id) ?? false,
      };
    });

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl px-4">
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm text-gray-600 hover:underline"
        >
          ← 대시보드
        </Link>

        {/* 프로젝트 헤더 */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {project.title}
                </h1>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {project.status === "DRAFT"
                    ? "준비 중"
                    : project.status === "PUBLISHED"
                    ? "공개"
                    : "완료"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {project.organizer.name} 님이 준비했어요
              </p>
            </div>
            {canEdit && (
              <Link
                href={`/projects/${project.id}/edit`}
                className="shrink-0 rounded border px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                수정
              </Link>
            )}
          </div>

          {project.description && (
            <p className="mb-3 whitespace-pre-line text-sm text-gray-700">
              {project.description}
            </p>
          )}

          {(project.startDate || project.endDate) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              {project.startDate && (
                <span>시작: {formatDate(project.startDate)}</span>
              )}
              {project.endDate && (
                <span>종료: {formatDate(project.endDate)}</span>
              )}
              <span>장소 {project.sites.length}곳</span>
              {canEdit && <span>참여자 {project.members.length}명</span>}
            </div>
          )}
        </div>

        {/* 좁은 화면 주최자용 안내 (모바일에서만) */}
        {canEdit && (
          <p className="mb-4 rounded bg-gray-50 p-3 text-xs text-gray-500 sm:hidden">
            편집은 PC 환경에서 하시는 걸 권장해요.
          </p>
        )}

        {/* 날짜(동선/일정)·장소 탭 */}
        <ProjectTabs
          projectId={project.id}
          canEdit={canEdit}
          sites={project.sites.map((site) => ({
            ...site,
            hasDescription: hasDescriptionBySiteId.get(site.id) ?? false,
          }))}
          scheduleSites={project.sites.map((s) => ({ id: s.id, name: s.name }))}
          schedules={project.schedules}
          hasDescriptionBySiteId={hasDescriptionBySiteId}
          stops={stops}
          routeData={
            project.routeData as Record<
              string,
              {
                path: number[][];
                distance: number;
                duration: number;
                legs: {
                  distance: number;
                  duration: number;
                  fromName: string;
                  toName: string;
                }[];
              }
            > | null
          }
          routeIsStale={routeIsStale}
        />

        {/* 초대 관리 (organizer만) */}
        {canEdit && (
          <div className="mb-6">
            <InvitationManager
              projectId={project.id}
              invitations={project.invitations.map((inv) => ({
                ...inv,
                daysLeft: Math.ceil(
                  (new Date(inv.expiresAt).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                ),
              }))}
              members={project.members}
            />
          </div>
        )}
      </div>
    </div>
  );
}