import prisma from "@/lib/prisma";

export async function getDeletionImpact(userId: string) {
  // 이 사용자가 조직자인 프로젝트들
  const ownedProjects = await prisma.project.findMany({
    where: { organizerId: userId },
    select: {
      id: true,
      title: true,
      _count: {
        select: { members: true, sites: true },
      },
    },
  });

  // 내가 만들지 않았는데 참가 중인 프로젝트 수.
  // ownedProjects 가 organizerId 기준이므로, 그 정확한 여집합인 "organizerId 가 내가 아닌 멤버십"으로 센다.
  // → 백필 이후 만든 사람이 갖게 된 자기 프로젝트의 ORGANIZER 멤버 행은 제외되고(이중 집계 방지),
  //   남이 만든 프로젝트에 공동 주최자(ORGANIZER)로 참여한 것은 포함된다(삭제 시 나만 빠지는 것이므로).
  const joinedCount = await prisma.projectMember.count({
    where: { userId, project: { organizerId: { not: userId } } },
  });

  // 영향받는 총 참여자 수 (내 프로젝트들의 멤버 합)
  const affectedMembers = ownedProjects.reduce(
    (sum, p) => sum + p._count.members,
    0
  );

  // 탈퇴를 막는 프로젝트: 삭제해도 살아남는(내가 만든 게 아닌) 프로젝트 중 내가 유일한 주최자인 것.
  // lib/auth.ts 의 beforeDelete 훅과 동일한 판정. 화면에서 미리 경고/차단하기 위해 목록을 반환한다.
  const soleOrganizerProjects = await prisma.project.findMany({
    where: {
      organizerId: { not: userId },
      members: { some: { userId, role: "ORGANIZER" } },
    },
    select: {
      id: true,
      title: true,
      members: { where: { role: "ORGANIZER" }, select: { id: true } },
    },
  });
  const blockingProjects = soleOrganizerProjects
    .filter((p) => p.members.length === 1)
    .map((p) => ({ id: p.id, title: p.title }));

  return {
    ownedProjects,
    ownedProjectCount: ownedProjects.length,
    joinedCount,
    affectedMembers,
    blockingProjects,
  };
}