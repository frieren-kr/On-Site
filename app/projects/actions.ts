"use server";

import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { createProjectSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { isProjectOrganizer } from "@/lib/permissions";
import { updateProjectSchema } from "@/lib/validations";
import { listR2Keys, deleteR2Objects } from "@/lib/r2";

export async function createProject(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  // 1. 인증 확인
  const session = await requireAuth();

  // 2. 권한 확인 - ORGANIZER만 생성 가능
  if (session.user.role !== "ORGANIZER") {
    return { error: "주최자만 프로젝트를 만들 수 있어요" };
  }

  // 3. 입력값 파싱 및 검증
  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    // 첫 번째 에러 메시지 반환
    return { error: parsed.error.issues[0].message };
  }

  const { title, description, startDate, endDate } = parsed.data;

  // 4. DB에 저장
  const project = await prisma.project.create({
    data: {
      title,
      description,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      organizerId: session.user.id,
      status: "DRAFT",
    },
  });

  // 5. 대시보드로 리다이렉트 (프로젝트 목록은 4-3에서 만들 예정)
  redirect(`/dashboard?created=${project.id}`);
}


export async function updateProject(input: {
  projectId: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await requireAuth();

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // 권한 검사 - 이 프로젝트의 organizer만 수정 가능
  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "수정 권한이 없어요" };
  }

  await prisma.project.update({
    where: { id: input.projectId },
    data: {
      title: input.title,
      description: input.description || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });

  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteProject(input: { projectId: string }) {
  const session = await requireAuth();

  // 권한 검사
  const isOwner = await isProjectOrganizer(session.user.id, input.projectId);
  if (!isOwner) {
    return { error: "삭제 권한이 없어요" };
  }

  // 삭제 - Cascade 설정 때문에 하위 데이터(sites, schedules, invitations, members)도 자동 삭제
  await prisma.project.delete({
    where: { id: input.projectId },
  });

  // R2에 남은 이 프로젝트 이미지들 정리. 실패해도 프로젝트 삭제는 이미 끝났으니
  // 함수는 성공으로 반환하고 로깅만 한다 (스토리지 청소 실패가 삭제를 되돌리면 안 됨).
  try {
    const keys = await listR2Keys(`projects/${input.projectId}/`);
    await deleteR2Objects(keys);
  } catch (e) {
    console.error(`R2 객체 삭제 실패 (project ${input.projectId}):`, e);
  }

  revalidatePath("/dashboard");
  return { success: true };
}