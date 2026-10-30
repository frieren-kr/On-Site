import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// 안드로이드 앱용 (조회 전용). 앱은 쿠키 대신 Authorization: Bearer 헤더로 인증한다.
// /api/* 는 proxy.ts matcher에서 제외되므로 인증은 여기서 직접 한다.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // 내 ProjectMember 행에서 출발 → 내가 속한 프로젝트만, 다른 멤버 정보는 조회 자체를 안 함
    const memberships = await prisma.projectMember.findMany({
      where: { userId: session.user.id },
      select: {
        role: true,
        project: {
          select: { id: true, title: true, startDate: true, endDate: true },
        },
      },
      orderBy: { project: { createdAt: "desc" } },
    });

    const projects = memberships.map(({ role, project }) => ({
      id: project.id,
      title: project.title,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      myRole: role,
    }));

    return Response.json({ projects });
  } catch (e) {
    console.error("[GET /api/mobile/projects]", e);
    return Response.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
