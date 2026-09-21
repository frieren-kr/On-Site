"use client";

import { useState, useTransition } from "react";
import {
  createInvitations,
  cancelInvitation,
} from "@/app/projects/[id]/actions";

interface Invitation {
  id: string;
  email: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
  createdAt: Date;
  expiresAt: Date;
  daysLeft: number;
}

interface InvitationManagerProps {
  projectId: string;
  invitations: Invitation[];
  members: Array<{
    id: string;
    joinedAt: Date;
    user: { name: string; email: string };
  }>;
}

export default function InvitationManager({
  projectId,
  invitations,
  members,
}: InvitationManagerProps) {
  const [emailsText, setEmailsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // 링크 도메인 (배포 후엔 vercel URL이 됨)
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    // 개행/쉼표로 분리
    const emails = emailsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setError("이메일을 입력하세요");
      return;
    }

    startTransition(async () => {
      const result = await createInvitations({
        projectId,
        emails,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setEmailsText("");
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created}개 초대 생성`);
      if (result.skipped) parts.push(`${result.skipped}개 건너뜀`);
      setNotice(parts.join(", "));
    });
  }

  function handleCopy(token: string) {
    const url = `${baseUrl}/invite/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  function handleCancel(invitationId: string, email: string) {
    if (!confirm(`${email}에 대한 초대를 취소할까요?`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await cancelInvitation({ invitationId, projectId });
      if (result.error) setError(result.error);
    });
  }

  const pendingInvitations = invitations.filter((i) => i.status === "PENDING");

  return (
    <div className="rounded-lg bg-card p-6 shadow">
      <h2 className="mb-4 text-lg font-semibold text-ink">
        참여자 초대
      </h2>

      {/* 초대 이메일 입력 폼 */}
      <form onSubmit={handleInvite} className="mb-6 space-y-2">
        <label className="block text-sm font-medium text-ink">
          이메일 (쉼표 또는 줄바꿈으로 여러 명)
        </label>
        <textarea
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          rows={3}
          placeholder={"student1@example.com \n student2@example.com, student3@example.com"}
          className="w-full rounded border px-3 py-2 text-sm text-ink"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            초대 링크는 14일간 유효합니다.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-accent px-3 py-1 text-sm text-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? "생성 중..." : "초대 링크 만들기"}
          </button>
        </div>

        {error && (
          <div className="rounded bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded bg-green-50 p-2 text-xs text-green-700">
            {notice}
          </div>
        )}
      </form>

      {/* 대기 중인 초대 */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-ink-muted">
          발급된 초대 ({pendingInvitations.length})
        </h3>
        {pendingInvitations.length === 0 ? (
          <p className="text-xs text-ink-muted">
            아직 발급된 초대가 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingInvitations.map((inv) => {
              const isCopied = copiedToken === inv.token;

              return (
                <li
                  key={inv.id}
                  className="flex items-center gap-2 rounded border p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm text-ink">{inv.email}</p>
                    <p className="text-xs text-ink-muted">
                      {inv.daysLeft > 0 ? `${inv.daysLeft}일 남음` : "만료됨"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(inv.token)}
                    className="rounded border px-2 py-1 text-xs text-ink-muted"
                  >
                    {isCopied ? "복사됨" : "링크 복사"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(inv.id, inv.email)}
                    disabled={isPending}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-30"
                  >
                    취소
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 참가 완료 멤버 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-muted">
          참가 중인 참여자 ({members.length})
        </h3>
        {members.length === 0 ? (
          <p className="text-xs text-ink-muted">
            아직 참가한 참여자가 없어요.
          </p>
        ) : (
          <ul className="space-y-1">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded border border-border p-2 text-sm"
              >
                <span className="font-medium text-ink">
                  {m.user.name}
                </span>
                <span className="text-xs text-ink-muted">
                  {m.user.email}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}