import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import prisma from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: ["ORGANIZER", "PARTICIPANT"],
        required: true,
        defaultValue: "PARTICIPANT",
        input: true,
      },
    },
    deleteUser: {
      enabled: true,
      // 마지막 주최자 방어 (서버 서킷). UI(설정 화면)에서도 미리 막지만,
      // API 직접 호출 등 UI 우회 대비 여기서 최종적으로 차단한다.
      beforeDelete: async (user) => {
        // 삭제해도 살아남는 프로젝트(= 내가 만든 게 아닌 것) 중,
        // 내가 유일한 주최자인 프로젝트를 찾는다. 만든 프로젝트는 cascade로 통째 삭제되므로 제외.
        const projects = await prisma.project.findMany({
          where: {
            organizerId: { not: user.id },
            members: { some: { userId: user.id, role: "ORGANIZER" } },
          },
          select: {
            id: true,
            title: true,
            members: { where: { role: "ORGANIZER" }, select: { id: true } },
          },
        });
        const blocking = projects.filter((p) => p.members.length === 1);
        if (blocking.length > 0) {
          const titles = blocking.map((p) => p.title).join(", ");
          throw new APIError("BAD_REQUEST", {
            message: `다음 프로젝트의 유일한 주최자예요: ${titles}. 다른 주최자를 초대하거나 프로젝트를 삭제한 뒤 탈퇴할 수 있어요.`,
          });
        }
      },
    },
  },
});