import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// 안드로이드 앱용 프로젝트 상세 (조회 전용). 인증은 Authorization: Bearer 헤더.
// /api/* 는 proxy.ts matcher에서 제외되므로 인증은 여기서 직접 한다.

const idSchema = z.cuid();

// 멤버가 아님 / 프로젝트 없음 / id 형식 오류를 모두 같은 응답으로 돌려준다.
// 403을 쓰면 "그 id의 프로젝트는 존재하지만 너는 권한이 없다"는 사실이 드러나서
// 남의 프로젝트 id가 유효한지 탐색할 수 있게 된다. 그래서 전부 404로 통일한다.
function notFound() {
  return Response.json({ error: "NOT_FOUND" }, { status: 404 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return notFound();

  try {
    // 내 ProjectMember 행에서 출발 → 멤버가 아니면 행 자체가 없다.
    // 다른 멤버·초대·이메일은 select하지 않으므로 조회 자체가 안 된다.
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: parsed.data, userId: session.user.id },
      },
      select: {
        role: true,
        project: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            routeData: true,
            routeUpdatedAt: true,
            sites: {
              select: {
                id: true,
                name: true,
                description: true,
                latitude: true,
                longitude: true,
                address: true,
                orderIndex: true,
              },
              orderBy: { orderIndex: "asc" },
            },
            schedules: {
              select: {
                id: true,
                title: true,
                date: true,
                startTime: true,
                endTime: true,
                orderIndex: true,
                siteId: true,
              },
              orderBy: [{ date: "asc" }, { orderIndex: "asc" }],
            },
          },
        },
      },
    });

    if (!membership) return notFound();

    const { role, project } = membership;
    return Response.json({
      project: {
        id: project.id,
        title: project.title,
        startDate: project.startDate?.toISOString() ?? null,
        endDate: project.endDate?.toISOString() ?? null,
        myRole: role,
      },
      sites: project.sites,
      schedules: project.schedules.map((s) => ({
        ...s,
        date: s.date.toISOString(),
      })),
      route: {
        // 날짜(YYYY-MM-DD)별 { path, distance, duration, legs }. 계산 전이면 null
        data: project.routeData ?? null,
        updatedAt: project.routeUpdatedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    console.error("[GET /api/mobile/projects/[id]]", e);
    return Response.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
