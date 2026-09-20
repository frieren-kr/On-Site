"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isProjectOrganizer } from "@/lib/permissions";
import {
  createSiteSchema,
  updateSiteSchema,
  createScheduleSchema,
  updateScheduleSchema,
  createInvitationsSchema,
} from "@/lib/validations";
import { calculateRoute } from "@/lib/directions";
import { extractR2Keys, deleteR2Objects } from "@/lib/r2";

export async function createSite(input: {
  projectId: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}) {
  // 1. 인증
  const session = await requireAuth();

  // 2. Zod 검증
  const parsed = createSiteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // 3. 권한 검사 - 이 프로젝트의 organizer만 장소 추가 가능
  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "이 프로젝트의 장소를 추가할 권한이 없어요" };
  }

  // 4. 현재 장소 개수 확인 (orderIndex 자동 할당용)
  const count = await prisma.site.count({
    where: { projectId: input.projectId },
  });

  // 5. DB에 저장
  const site = await prisma.site.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address || null,
      orderIndex: count, // 마지막 순서로 추가
    },
  });

  // 6. 캐시 무효화 - 프로젝트 페이지 다시 렌더링되게
  revalidatePath(`/projects/${input.projectId}`);

  return { success: true, siteId: site.id };
}
export async function deleteSite(input: { siteId: string; projectId: string }) {
  const session = await requireAuth();

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "삭제 권한이 없어요" };
  }

  const site = await prisma.site.findUnique({
    where: { id: input.siteId },
  });
  if (!site || site.projectId !== input.projectId) {
    return { error: "장소를 찾을 수 없어요" };
  }

  await prisma.$transaction([
    prisma.site.delete({ where: { id: input.siteId } }),
    prisma.site.updateMany({
      where: {
        projectId: input.projectId,
        orderIndex: { gt: site.orderIndex },
      },
      data: { orderIndex: { decrement: 1 } },
    }),
  ]);

  // 해설(description)에 박혀 있던 R2 이미지들 정리. DB 삭제는 이미 끝났으니
  // 실패해도 성공 반환하고 로깅만 한다 (스토리지 청소 실패가 삭제를 되돌리면 안 됨).
  try {
    const keys = extractR2Keys(site.description ?? "");
    await deleteR2Objects(keys);
  } catch (e) {
    console.error(`R2 객체 삭제 실패 (site ${input.siteId}):`, e);
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { success: true };
}


export async function reorderSite(input: {
  siteId: string;
  projectId: string;
  direction: "up" | "down";
}) {
  const session = await requireAuth();

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "권한이 없어요" };
  }

  // 이동 대상 장소 조회
  const current = await prisma.site.findUnique({
    where: { id: input.siteId },
  });
  if (!current || current.projectId !== input.projectId) {
    return { error: "장소를 찾을 수 없어요" };
  }

  // 위로 = orderIndex - 1인 장소와 자리 바꿈
  // 아래로 = orderIndex + 1인 장소와 자리 바꿈
  const targetIndex =
    input.direction === "up"
      ? current.orderIndex - 1
      : current.orderIndex + 1;

  const neighbor = await prisma.site.findFirst({
    where: {
      projectId: input.projectId,
      orderIndex: targetIndex,
    },
  });
  if (!neighbor) {
    return { error: "더 이동할 수 없어요" }; // 맨 위/아래
  }

  // 두 장소의 orderIndex를 서로 바꿈 (트랜잭션)
  await prisma.$transaction([
    prisma.site.update({
      where: { id: current.id },
      data: { orderIndex: targetIndex },
    }),
    prisma.site.update({
      where: { id: neighbor.id },
      data: { orderIndex: current.orderIndex },
    }),
  ]);

  revalidatePath(`/projects/${input.projectId}`);
  return { success: true };
}

export async function updateSite(input: {
  siteId: string;
  projectId: string;
  name: string;
  description?: string;
}) {
  const session = await requireAuth();

  const parsed = updateSiteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "수정 권한이 없어요" };
  }

  // IDOR 방어 - 이 장소가 진짜 이 프로젝트 소속인지 확인
  const site = await prisma.site.findUnique({
    where: { id: input.siteId },
  });
  if (!site || site.projectId !== input.projectId) {
    return { error: "장소를 찾을 수 없어요" };
  }

  await prisma.site.update({
    where: { id: input.siteId },
    data: {
      name: input.name,
      description: input.description || null,
    },
  });

  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/projects/${input.projectId}/sites/${input.siteId}`);
  return { success: true };
}
export async function createSchedule(input: {
  projectId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  siteId?: string;
}) {
  const session = await requireAuth();

  const parsed = createScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "일정 추가 권한이 없어요" };
  }

  // 시각 논리 검증 - 시작 < 종료
  if (input.startTime >= input.endTime) {
    return { error: "종료 시각은 시작 시각보다 늦어야 해요" };
  }

  // siteId가 있으면 이 프로젝트 소속인지 확인 (IDOR 방어)
  if (input.siteId) {
    const site = await prisma.site.findUnique({
      where: { id: input.siteId },
    });
    if (!site || site.projectId !== input.projectId) {
      return { error: "연결할 장소가 이 프로젝트에 없어요" };
    }
  }

  // orderIndex - 같은 날짜의 마지막 일정 다음 순서
  const count = await prisma.schedule.count({
    where: {
      projectId: input.projectId,
      date: new Date(input.date),
    },
  });

  await prisma.schedule.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      date: new Date(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      siteId: input.siteId || null,
      orderIndex: count,
    },
  });

  revalidatePath(`/projects/${input.projectId}`);
  return { success: true };
}

export async function updateSchedule(input: {
  scheduleId: string;
  projectId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  siteId?: string;
}) {
  const session = await requireAuth();

  const parsed = updateScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "수정 권한이 없어요" };
  }

  if (input.startTime >= input.endTime) {
    return { error: "종료 시각은 시작 시각보다 늦어야 해요" };
  }

  // IDOR 방어 - 이 일정이 진짜 이 프로젝트 소속인지
  const schedule = await prisma.schedule.findUnique({
    where: { id: input.scheduleId },
  });
  if (!schedule || schedule.projectId !== input.projectId) {
    return { error: "일정을 찾을 수 없어요" };
  }

  // siteId도 프로젝트 소속 확인
  if (input.siteId) {
    const site = await prisma.site.findUnique({
      where: { id: input.siteId },
    });
    if (!site || site.projectId !== input.projectId) {
      return { error: "연결할 장소가 이 프로젝트에 없어요" };
    }
  }

  // 날짜가 바뀐 경우 orderIndex 처리
  const oldDate = new Date(schedule.date).toISOString().split("T")[0];
  const newDate = input.date;

  if (oldDate !== newDate) {
    // 새 날짜의 마지막 순서로 재배치
    const countInNewDate = await prisma.schedule.count({
      where: {
        projectId: input.projectId,
        date: new Date(newDate),
      },
    });

    // 원래 날짜의 빈 자리 메우기 + 새 날짜로 이동을 한 트랜잭션으로 묶어 원자성 보장
    await prisma.$transaction([
      prisma.schedule.updateMany({
        where: {
          projectId: input.projectId,
          date: schedule.date,
          orderIndex: { gt: schedule.orderIndex },
        },
        data: {
          orderIndex: { decrement: 1 },
        },
      }),
      prisma.schedule.update({
        where: { id: input.scheduleId },
        data: {
          title: input.title,
          date: new Date(newDate),
          startTime: input.startTime,
          endTime: input.endTime,
          siteId: input.siteId || null,
          orderIndex: countInNewDate,
        },
      }),
    ]);
  } else {
    // 날짜가 그대로면 orderIndex 유지, 나머지만 업데이트
    await prisma.schedule.update({
      where: { id: input.scheduleId },
      data: {
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        siteId: input.siteId || null,
      },
    });
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { success: true };
}

export async function deleteSchedule(input: {
  scheduleId: string;
  projectId: string;
}) {
  const session = await requireAuth();

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "삭제 권한이 없어요" };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: input.scheduleId },
  });
  if (!schedule || schedule.projectId !== input.projectId) {
    return { error: "일정을 찾을 수 없어요" };
  }

  // 삭제 + 같은 날짜 뒤 순서 앞당기기를 한 트랜잭션으로 묶어 원자성 보장
  await prisma.$transaction([
    prisma.schedule.delete({
      where: { id: input.scheduleId },
    }),
    prisma.schedule.updateMany({
      where: {
        projectId: input.projectId,
        date: schedule.date,
        orderIndex: { gt: schedule.orderIndex },
      },
      data: {
        orderIndex: { decrement: 1 },
      },
    }),
  ]);

  revalidatePath(`/projects/${input.projectId}`);
  return { success: true };
}

export async function createInvitations(input: {
  projectId: string;
  emails: string[];
}) {
  const session = await requireAuth();

  // 이메일 정규화 (소문자화 + 공백 제거 + 중복 제거)
  const normalizedEmails = Array.from(
    new Set(
      input.emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0)
    )
  );

  const parsed = createInvitationsSchema.safeParse({
    projectId: input.projectId,
    emails: normalizedEmails,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "초대 권한이 없어요" };
  }

  // 이미 이 프로젝트에 PENDING 초대가 있는 이메일 필터링 (중복 초대 방지)
  const existingInvitations = await prisma.invitation.findMany({
    where: {
      projectId: input.projectId,
      email: { in: normalizedEmails },
      status: "PENDING",
    },
    select: { email: true },
  });
  const existingEmails = new Set(
  existingInvitations.map((i: { email: string }) => i.email)
  );

  // 이미 참가한 사용자도 제외
  const existingMembers = await prisma.projectMember.findMany({
    where: {
      projectId: input.projectId,
      user: { email: { in: normalizedEmails } },
    },
    select: { user: { select: { email: true } } },
  });
  const memberEmails = new Set(existingMembers.map((m: { user: {email: string}}) => m.user.email));

  const toInvite = normalizedEmails.filter(
    (email) => !existingEmails.has(email) && !memberEmails.has(email)
  );

  if (toInvite.length === 0) {
    return { error: "모든 이메일이 이미 초대되었거나 참여 중이에요" };
  }

  // 14일 후 만료
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await prisma.invitation.createMany({
    data: toInvite.map((email) => ({
      projectId: input.projectId,
      email,
      expiresAt,
    })),
  });

  revalidatePath(`/projects/${input.projectId}`);

  const skipped = normalizedEmails.length - toInvite.length;
  return {
    success: true,
    created: toInvite.length,
    skipped,
  };
}

export async function cancelInvitation(input: {
  invitationId: string;
  projectId: string;
}) {
  const session = await requireAuth();

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "권한이 없어요" };
  }

  // IDOR 방어
  const invitation = await prisma.invitation.findUnique({
    where: { id: input.invitationId },
  });
  if (!invitation || invitation.projectId !== input.projectId) {
    return { error: "초대를 찾을 수 없어요" };
  }

  if (invitation.status !== "PENDING") {
    return { error: "이미 처리된 초대는 취소할 수 없어요" };
  }

  await prisma.invitation.delete({
    where: { id: input.invitationId },
  });

  revalidatePath(`/projects/${input.projectId}`);
  return { success: true };
}

export async function updateProjectRoute(input: { projectId: string }) {
  const session = await requireAuth();

  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "경로를 계산할 권한이 없어요" };
  }

  // 일정을 날짜순·시간순으로, 장소 좌표까지 함께 조회
  const schedules = await prisma.schedule.findMany({
    where: {
      projectId: input.projectId,
      siteId: { not: null }, // 장소 연결된 일정만
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: {
      site: {
        select: { latitude: true, longitude: true, name:true },
      },
    },
  });

  if (schedules.length < 2) {
    return {
      error: "장소가 연결된 일정이 2개 이상 있어야 경로를 계산할 수 있어요",
    };
  }

  // 날짜별로 그룹핑
  const byDate: Record <
    string,
    { latitude: number; longitude: number; name: string }[]
  > = {};

  for (const s of schedules) {
    if (!s.site) continue;
    // 로컬 기준 날짜 키
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

    if (!byDate[key]) byDate[key] = [];
    byDate[key].push({
      latitude: s.site.latitude,
      longitude: s.site.longitude,
      name: s.site.name,
    });
  }

  // 각 날짜별로 경로 계산
  const routeData: Record <
    string,
    { path: number[][]; distance: number; duration: number; legs: {distance: number; duration:number} [] }
  > = {};

  try {
    for (const [dateKey, points] of Object.entries(byDate)) {
      // 그 날 장소가 1곳뿐이면 경로 없음 (건너뜀)
      if (points.length < 2) continue;

      if (points.length > 16) {
        return {
          error: `${dateKey}에 장소가 너무 많아요 (하루 최대 16곳)`,
        };
      }

      const result = await calculateRoute(points);
      if (result) {
        const usedPoints = points.slice(0, result.usedPointCount);

        const legsWithNames = result.legs.map((leg,i)=>({
          distance: leg.distance,
          duration:leg.duration,
          fromName:usedPoints[i]?.name ?? "",
          toName: usedPoints[i+1]?.name ?? "",
        }));
        
        routeData[dateKey] = {
          path: result.path,
          distance: result.distance,
          duration: result.duration,
          legs: legsWithNames,
        };
      }
    }

    if (Object.keys(routeData).length === 0) {
      return {
        error: "경로를 계산할 수 있는 날짜가 없어요 (하루에 장소 2곳 이상 필요)",
      };
    }

    await prisma.project.update({
      where: { id: input.projectId },
      data: {
        routeData: routeData,
        routeUpdatedAt: new Date(),
      },
    });

    revalidatePath(`/projects/${input.projectId}`);
    return { success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "경로 계산 중 오류가 발생했어요",
    };
  }
}