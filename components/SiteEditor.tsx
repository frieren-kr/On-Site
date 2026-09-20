"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { updateSite } from "@/app/projects/[id]/actions";
import ImageUploadButton from "@/components/ImageUploadButton";

interface SiteEditorProps {
  site: {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
  };
  canEdit: boolean;
}

export default function SiteEditor({ site, canEdit }: SiteEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(site.name);
  const [description, setDescription] = useState(site.description || "");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 업로드된 이미지 마크다운을 textarea 커서 위치에 삽입한다.
  // 커서를 못 잡으면(ref 없음 = 미리보기 탭 등) 맨 끝에 append 폴백.
  function handleImageInsert(markdown: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDescription((prev) => (prev ? `${prev}\n${markdown}` : markdown));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setDescription((prev) => prev.slice(0, start) + markdown + prev.slice(end));

    // 삽입 직후 커서를 삽입한 텍스트 끝으로 이동
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + markdown.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  function handleSave() {
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateSite({
        siteId: site.id,
        projectId: site.projectId,
        name: name.trim(),
        description: description.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setIsEditing(false);
      router.refresh(); // 서버에서 다시 데이터 가져오게
    });
  }

  function handleCancel() {
    // 원래 값으로 되돌리기
    setName(site.name);
    setDescription(site.description || "");
    setError(null);
    setIsEditing(false);
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      {/* 위치 정보 - 항상 표시 */}
      <div className="mb-4 border-b pb-4">
        {site.address && (
          <p className="text-sm text-gray-600">{site.address}</p>
        )}
        <p className="text-xs text-gray-400">
          위도 {site.latitude.toFixed(6)} · 경도 {site.longitude.toFixed(6)}
        </p>
      </div>

      {/* 조회 모드 */}
      {!isEditing && (
        <>
          <div className="mb-4 flex items-start justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded border px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                해설 편집
              </button>
            )}
          </div>

          {site.description ? (
            <div className="prose prose-sm max-w-none text-gray-900 [&_img]:max-w-full [&_img]:h-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {site.description}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {canEdit
                ? "아직 해설이 없어요. '해설 편집'을 눌러 작성해보세요."
                : "아직 해설이 없어요."}
            </p>
          )}
        </>
      )}

      {/* 편집 모드 */}
      {isEditing && (
        <>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-900">
              장소 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full rounded border px-3 py-2 text-gray-900"
            />
          </div>

          <div className="mb-4">
            {/* 1층: 해설 label 단독 (문법 예시는 placeholder에 있으므로 생략) */}
            <label className="mb-1 block text-sm font-medium text-gray-900">
              해설
            </label>

            {/* 2층: 편집/미리보기 탭 (왼쪽 정렬) */}
            <div className="mb-2 flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={`whitespace-nowrap rounded px-2 py-1 ${
                  activeTab === "edit"
                    ? "bg-gray-900 text-white"
                    : "border text-gray-700"
                }`}
              >
                편집
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`whitespace-nowrap rounded px-2 py-1 ${
                  activeTab === "preview"
                    ? "bg-gray-900 text-white"
                    : "border text-gray-700"
                }`}
              >
                미리보기
              </button>
            </div>

            {/* 3층: 삽입 툴바 — 커서 삽입은 편집 탭에서만 의미 있으므로 편집 탭에서만 노출.
                좁은 폭에선 다음 줄로 wrap. */}
            {activeTab === "edit" && (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <ImageUploadButton
                  projectId={site.projectId}
                  onUploaded={handleImageInsert}
                  disabled={isPending}
                />
                {/* 오른쪽 여백에 마크다운 작성 요령. 좁으면 버튼 아래로 wrap */}
                <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-400">
                  <span>마크다운:</span>
                  <code className="whitespace-nowrap rounded bg-gray-100 px-1 text-gray-600">
                    **굵게**
                  </code>
                  <code className="whitespace-nowrap rounded bg-gray-100 px-1 text-gray-600">
                    *기울임*
                  </code>
                  <code className="whitespace-nowrap rounded bg-gray-100 px-1 text-gray-600">
                    # 제목
                  </code>
                  <code className="whitespace-nowrap rounded bg-gray-100 px-1 text-gray-600">
                    - 목록
                  </code>
                  <code className="whitespace-nowrap rounded bg-gray-100 px-1 text-gray-600">
                    [링크](url)
                  </code>
                </div>
              </div>
            )}

            {activeTab === "edit" ? (
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={16}
                maxLength={10000}
                placeholder={`마크다운 문법 예시:
## 소제목
**굵게** *기울임* [링크](https://...)
- 목록 항목
- 다른 항목

| 연대 | 사건 |
| --- | --- |
| 1395 | 경복궁 창건 |`}
                className="w-full rounded border px-3 py-2 font-mono text-sm text-gray-900"
              />
            ) : (
              <div className="min-h-[400px] rounded border bg-gray-50 p-4">
                {description ? (
                  <div className="prose prose-sm max-w-none text-gray-900 [&_img]:max-w-full [&_img]:h-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    미리볼 내용이 없어요
                  </p>
                )}
              </div>
            )}

            <p className="mt-1 text-xs text-gray-500">
              {description.length} / 10000
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded border px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}