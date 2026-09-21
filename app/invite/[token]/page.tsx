import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import Link from "next/link";
import AcceptInvitationButton from "@/components/AcceptInvitationButton";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();

  // 초대 정보 조회 (프로젝트 정보 포함)
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          description: true,
          startDate: true,
          endDate: true,
          organizer: {
            select: { name: true },
          },
          _count: {
            select: { sites: true, members: true },
          },
        },
      },
    },
  });

  // 초대 자체가 없거나 취소된 경우
  if (!invitation) {
    return (
      <InvalidInvite message="존재하지 않거나 취소된 초대예요." />
    );
  }

  // 만료
  const isExpired = new Date() > invitation.expiresAt;
  if (isExpired || invitation.status === "EXPIRED") {
    return (
      <InvalidInvite message="만료된 초대예요. 조직자에게 새 초대 링크를 요청하세요." />
    );
  }

  // 이미 수락된 초대
  if (invitation.status === "ACCEPTED") {
    return (
      <InvalidInvite
        message="이미 수락된 초대예요."
        primaryAction={{
          label: "대시보드로",
          href: "/dashboard",
        }}
      />
    );
  }

  // 상황별 분기
  const isLoggedIn = !!session;
  const userEmail = session?.user.email.toLowerCase() || "";
  const invitedEmail = invitation.email.toLowerCase();
  const emailMatches = isLoggedIn && userEmail === invitedEmail;

  // 이미 멤버인지 확인 (로그인된 경우만)
  let alreadyMember = false;
  if (isLoggedIn) {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: invitation.projectId,
          userId: session.user.id,
        },
      },
    });
    alreadyMember = !!member;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface py-8">
      <div className="w-full max-w-md rounded-lg bg-card p-8 shadow">
        <p className="mb-2 text-xs text-ink-muted">프로젝트 초대장</p>
        <h1 className="mb-1 text-2xl font-bold text-ink">
          {invitation.project.title}
        </h1>
        <p className="mb-4 text-sm text-ink-muted">
          {invitation.project.organizer.name} 님이 초대했어요
        </p>

        {invitation.project.description && (
          <p className="mb-4 text-sm text-ink-muted">
            {invitation.project.description}
          </p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-2 text-xs text-ink-muted">
          <div className="rounded bg-panel p-2">
            장소 {invitation.project._count.sites}곳
          </div>
          <div className="rounded bg-panel p-2">
            참여자 {invitation.project._count.members}명
          </div>
        </div>

        <div className="mb-4 rounded border border-border bg-panel p-3 text-xs text-ink-muted">
          이 초대는 <strong>{invitation.email}</strong> 계정으로만
          수락할 수 있어요.
        </div>

        {/* 상황별 CTA */}
        {alreadyMember ? (
          <div className="space-y-2">
            <div className="rounded bg-green-50 p-3 text-sm text-green-800">
              이미 참여 중인 프로젝트예요.
            </div>
            <Link
              href={`/projects/${invitation.projectId}`}
              className="block rounded bg-accent py-2 text-center text-sm text-ink hover:bg-accent-strong"
            >
              프로젝트로 이동
            </Link>
          </div>
        ) : !isLoggedIn ? (
          <div className="space-y-2">
            <Link
              href={`/sign-up?invite=${token}&email=${encodeURIComponent(
                invitation.email
              )}`}
              className="block rounded bg-accent py-2 text-center text-sm text-ink hover:bg-accent-strong"
            >
              회원가입하고 참여
            </Link>
            <Link
              href={`/sign-in?invite=${token}`}
              className="block rounded border border-secondary bg-secondary-tint py-2 text-center text-sm text-secondary-ink hover:bg-secondary-tint-strong"
            >
              이미 계정이 있어요
            </Link>
          </div>
        ) : !emailMatches ? (
          <div className="space-y-2">
            <div className="rounded border border-warning-border bg-warning-tint p-3 text-sm text-warning-ink">
              현재 <strong>{session.user.email}</strong> 계정으로 로그인
              중이에요.
              <br />
              초대받은 계정으로 다시 로그인해주세요.
            </div>
            <Link
              href={`/sign-in?invite=${token}`}
              className="block rounded border border-secondary bg-secondary-tint py-2 text-center text-sm text-secondary-ink hover:bg-secondary-tint-strong"
            >
              다른 계정으로 로그인
            </Link>
          </div>
        ) : (
          <AcceptInvitationButton token={token} />
        )}
      </div>
    </div>
  );
}

// 유효하지 않은 초대용 화면
function InvalidInvite({
  message,
  primaryAction,
}: {
  message: string;
  primaryAction?: { label: string; href: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="max-w-md rounded-lg bg-card p-8 shadow">
        <h1 className="mb-4 text-xl font-bold text-ink">프로젝트 초대장</h1>
        <p className="mb-4 text-sm text-ink-muted">{message}</p>
        {primaryAction && (
          <Link
            href={primaryAction.href}
            className="block rounded bg-accent py-2 text-center text-sm text-ink hover:bg-accent-strong"
          >
            {primaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}