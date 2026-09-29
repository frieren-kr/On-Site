"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { acceptInvitationSchema } from "@/lib/validations";

export async function acceptInvitation(input: { token: string }) {
  const session = await requireAuth();

  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // 초대 조회
  const invitation = await prisma.invitation.findUnique({
    where: { token: input.token },
  });

  if (!invitation) {
    return { error: "존재하지 않는 초대예요" };
  }

  // 상태 확인
  if (invitation.status !== "PENDING") {
    return { error: "이미 처리된 초대예요" };
  }

  // 만료 확인
  if (new Date() > invitation.expiresAt) {
    // 만료 상태로 업데이트해두면 다음부터 명확
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return { error: "만료된 초대예요" };
  }

  // 핵심 방어: 로그인한 사용자의 이메일이 초대 이메일과 일치하는가
  const userEmail = session.user.email.toLowerCase();
  if (userEmail !== invitation.email.toLowerCase()) {
    return {
      error: `이 초대는 ${invitation.email} 계정을 위한 거예요. 해당 이메일로 로그인해주세요.`,
    };
  }

  // 역할 일치 검사: 계정 역할과 초대 역할이 같아야 수락 가능.
  // (이미 멤버인 경우에도 이 검증을 먼저 통과해야 한다)
  if (session.user.role !== invitation.role) {
    const roleLabel = (r: string) =>
      r === "ORGANIZER" ? "주최자" : r === "ADMIN" ? "관리자" : "참여자";
    return {
      error: `이 초대는 ${roleLabel(invitation.role)} 계정으로만 수락할 수 있어요. ${roleLabel(
        session.user.role
      )} 계정을 삭제하고 ${roleLabel(invitation.role)}로 다시 가입해야 합니다.`,
    };
  }

  // 이미 참가 중인지 확인
  const existing = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: invitation.projectId,
        userId: session.user.id,
      },
    },
  });

  if (existing) {
    // 이미 멤버면 초대 상태만 정리하고 통과
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });
    return { success: true, projectId: invitation.projectId };
  }

  // 참가 처리 (트랜잭션: 초대 상태 변경 + 멤버 추가를 원자적으로)
  await prisma.$transaction([
    prisma.projectMember.create({
      data: {
        projectId: invitation.projectId,
        userId: session.user.id,
        role: invitation.role,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${invitation.projectId}`);

  return { success: true, projectId: invitation.projectId };
}