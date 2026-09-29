import prisma from "@/lib/prisma";

/**
 * 이 사용자가 이 프로젝트에 접근 가능한가?
 * - 만든 사람(organizer)이거나
 * - 참가자(member)이면 OK
 */
export async function canAccessProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { organizerId: userId },
        { members: { some: { userId } } },
      ],
    },
  });
  return project !== null;
}

/**
 * 이 사용자가 이 프로젝트의 organizer인가?
 * 프로젝트 수정/삭제처럼 organizer만 할 수 있는 작업용
 *
 * 판정 기준은 project.organizerId(만든 사람)가 아니라
 * ProjectMember.role === "ORGANIZER" 다. organizerId 는 '만든 사람' 표시용으로만 남는다.
 */
export async function isProjectOrganizer(userId: string, projectId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return member?.role === "ORGANIZER";
}