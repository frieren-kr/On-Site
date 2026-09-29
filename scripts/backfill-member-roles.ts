// scripts/backfill-member-roles.ts
// 일회성 백필: 각 프로젝트의 organizerId 유저를 ProjectMember(role=ORGANIZER)로 정착시킨다.
//
// 왜: 권한 판정을 project.organizerId 대신 ProjectMember.role 기반으로 옮기기 위한 사전 작업.
//     기존 참여자 ProjectMember 는 db push 시 기본값 PARTICIPANT 로 이미 채워져 있으므로 건드리지 않는다.
//
// 실행:
//   dry-run(계획만, 기본):  node scripts/backfill-member-roles.ts
//   실제 실행:              node scripts/backfill-member-roles.ts --apply
//
// self-contained: tsconfig path alias(@/) 없이 node_modules 만 import 하고
// 자체 PrismaClient(adapter-pg) + dotenv 로 DATABASE_URL 을 읽는다 → `node`로 바로 실행 가능.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const APPLY = process.argv.includes("--apply");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 환경변수가 없습니다. .env 를 확인하세요.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      organizerId: true,
      members: {
        select: { userId: true, role: true },
      },
    },
  });

  console.log(
    `\n=== ProjectMember role 백필 ${APPLY ? "(APPLY: 실제 실행)" : "(DRY-RUN: 계획만)"} ===`
  );
  console.log(`총 프로젝트: ${projects.length}\n`);

  let toInsert = 0;
  let toUpdate = 0;
  let alreadyOk = 0;

  for (const p of projects) {
    const existing = p.members.find((m) => m.userId === p.organizerId);
    if (!existing) {
      toInsert++;
      console.log(
        `[INSERT] project=${p.id} "${p.title}" — organizer ${p.organizerId} 를 ProjectMember(role=ORGANIZER)로 추가`
      );
    } else if (existing.role !== "ORGANIZER") {
      toUpdate++;
      console.log(
        `[UPDATE] project=${p.id} "${p.title}" — organizer ${p.organizerId} 의 role ${existing.role} -> ORGANIZER`
      );
    } else {
      alreadyOk++;
      console.log(
        `[SKIP  ] project=${p.id} "${p.title}" — organizer 이미 ORGANIZER`
      );
    }
  }

  console.log(
    `\n계획 요약: INSERT ${toInsert}건, UPDATE ${toUpdate}건, 이미정상 ${alreadyOk}건`
  );

  if (APPLY) {
    console.log(`\n--apply 감지 — 실제 upsert 실행...`);
    for (const p of projects) {
      // @@unique([projectId, userId]) 덕분에 upsert 로 중복 없이 정착
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId: p.id, userId: p.organizerId },
        },
        update: { role: "ORGANIZER" },
        create: {
          projectId: p.id,
          userId: p.organizerId,
          role: "ORGANIZER",
        },
      });
    }
    console.log(`upsert 완료 (${projects.length}개 프로젝트).`);
  } else {
    console.log(
      `\n(DRY-RUN) 실제 변경 없음. 위 계획 검토 후 --apply 로 다시 실행하세요.`
    );
  }

  // 3. 검증: 모든 프로젝트에 role=ORGANIZER 멤버가 최소 1명인지
  console.log(`\n=== 검증: 프로젝트별 ORGANIZER 멤버 수 ===`);
  const withCounts = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      _count: {
        select: {
          members: { where: { role: "ORGANIZER" } },
        },
      },
    },
  });

  const zero = withCounts.filter((p) => p._count.members === 0);
  if (zero.length === 0) {
    console.log(
      `✅ 모든 프로젝트에 ORGANIZER 멤버가 최소 1명 존재 (총 ${withCounts.length}개)`
    );
  } else {
    console.log(
      `⚠️  경고: ORGANIZER 멤버가 0명인 프로젝트 ${zero.length}개 (권한 판정 전환 시 접근 불가 위험):`
    );
    zero.forEach((p) => console.log(`   - ${p.id} "${p.title}"`));
  }
}

main()
  .catch((e) => {
    console.error("백필 중 오류:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
