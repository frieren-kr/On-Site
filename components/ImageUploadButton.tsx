"use client";

import { useRef, useState } from "react";
import { createUploadUrl } from "@/app/projects/[id]/photo-actions";

interface ImageUploadButtonProps {
  projectId: string;
  onUploaded: (markdownUrl: string) => void;
  disabled?: boolean;
}

export default function ImageUploadButton({
  projectId,
  onUploaded,
  disabled,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 onChange가 다시 발화하도록 input 값 초기화
    e.target.value = "";
    if (!file) return;

    // presign에 넘길 값과 PUT 헤더에 실을 값을 하나의 변수로 고정한다.
    // 이 둘이 정확히 같아야 R2 서명 검증이 통과한다.
    const contentType = file.type;

    setError(null);
    setIsUploading(true);
    try {
      // 1. presign 발급 (권한 + 타입 화이트리스트 검증은 서버가 한다)
      const result = await createUploadUrl({ projectId, contentType });
      if ("error" in result) {
        setError(result.error);
        return;
      }

      // 2. R2로 직접 PUT — FormData 쓰지 않고 file 객체를 그대로 body에.
      //    Content-Type은 presign에 넘긴 값(contentType)과 반드시 동일.
      const res = await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });

      if (!res.ok) {
        setError("이미지 업로드에 실패했어요");
        return;
      }

      // 3. 마크다운 이미지 문법으로 콜백 (공개 읽기 주소)
      onUploaded(`![이미지](${result.publicUrl})`);
    } catch {
      setError("이미지 업로드 중 오류가 발생했어요");
    } finally {
      setIsUploading(false);
    }
  }

  const isDisabled = disabled || isUploading;

  return (
    <div className="flex items-center gap-2">
      <label
        className={`cursor-pointer whitespace-nowrap rounded border px-2 py-1 text-xs text-ink-muted hover:bg-panel ${
          isDisabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {isUploading ? "업로드 중..." : "이미지 추가"}
        {/* 실제 input은 숨기고 label 클릭으로 트리거 */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          disabled={isDisabled}
          className="hidden"
        />
      </label>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
