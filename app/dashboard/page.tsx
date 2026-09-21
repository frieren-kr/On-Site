import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const justCreated = params.created;

  // 주최자: 본인이 만든 프로젝트 목록
  // 참여자: 참가한 프로젝트 목록 (아직 초대 시스템 없어서 비어있을 예정)

  const projects =
    session.user.role === "ORGANIZER"
      ? await prisma.project.findMany({
          where: { organizerId: session.user.id },
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { sites: true, members: true },
            },
          },
        })
      : session.user.role === "PARTICIPANT"
      ? await prisma.project.findMany({
          where: {
            members: { some: { userId: session.user.id } },
          },
          orderBy: { startDate: "asc" },
          include: {
            _count: {
              select: { sites: true },
            },
          },
        })
      : [];

  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="mx-auto max-w-4xl px-4">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
            <p className="text-sm text-gray-600">
              {session.user.name}님 ·{" "}
              {session.user.role === "ORGANIZER"
                ? "주최자"
                : "참여자"}
            </p>
          </div>
          <Link
            href="/settings"
            className="text-sm text-gray-600 hover:underline"
          >
            설정
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-600 hover:underline"
          >
            메인
          </Link>
        </div>

        {/* 방금 생성됨 알림 */}
        {justCreated && (
          <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">
            프로젝트가 생성되었어요.
          </div>
        )}

        {/* 주최자 뷰 */}
        {session.user.role === "ORGANIZER" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                내 프로젝트 ({projects.length})
              </h2>
              {projects.length > 0 && (
                <Link
                  href="/projects/new"
                  className="rounded bg-accent px-4 py-2 text-sm text-ink hover:bg-accent-strong"
                >
                  + 새 프로젝트
                </Link>
              )}
            </div>

            {projects.length === 0 ? (
              <div className="rounded-lg bg-card p-8 text-center shadow">
                <p className="mb-4 text-gray-600">
                  아직 만든 프로젝트가 없어요.
                </p>
                <Link
                  href="/projects/new"
                  className="inline-block rounded bg-accent px-4 py-2 text-sm text-ink hover:bg-accent-strong"
                >
                  첫 프로젝트 만들기
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((project: ProjectCardData) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    role="ORGANIZER"
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* 참여자 뷰 */}
        {session.user.role === "PARTICIPANT" && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              참여 중인 프로젝트 ({projects.length})
            </h2>

            {projects.length === 0 ? (
              <div className="rounded-lg bg-card p-8 text-center shadow">
                <p className="text-gray-600">
                  아직 초대받은 프로젝트가 없어요.
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  주최자에게 초대 링크를 받으면 여기에 표시돼요.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((project: ProjectCardData) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    role="PARTICIPANT"
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type ProjectCardData = {
  id: string;
  title: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  _count: { sites: number; members?: number };
};

// 프로젝트 카드 컴포넌트 (같은 파일 안에 둠)
function ProjectCard({
  project,
  role,
}: {
  project: {
    id: string;
    title: string;
    description: string | null;
    startDate: Date | null;
    endDate: Date | null;
    status: string;
    _count: { sites: number; members?: number };
  };
  role: "ORGANIZER" | "PARTICIPANT";
}) {
  const formatDate = (d: Date) => new Date(d).toLocaleDateString("ko-KR");
  const period =
    project.startDate && project.endDate
      ? `${formatDate(project.startDate)} ~ ${formatDate(project.endDate)}`
      : project.startDate
      ? `${formatDate(project.startDate)} ~`
      : project.endDate
      ? `~ ${formatDate(project.endDate)}`
      : null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-lg bg-card p-4 shadow hover:shadow-md"
    >
      <h3 className="mb-1 font-semibold text-gray-900">{project.title}</h3>

      {period && (
        <p className="mb-2 text-sm font-medium text-gray-700">{period}</p>
      )}

      {project.description && (
        <p className="mb-3 line-clamp-2 text-sm text-gray-600">
          {project.description}
        </p>
      )}

      <div className="flex gap-3 text-xs text-gray-500">
        <span>장소 {project._count.sites}개</span>
        {role === "ORGANIZER" && project._count.members !== undefined && (
          <span>참여자 {project._count.members}명</span>
        )}
      </div>
    </Link>
  );
}