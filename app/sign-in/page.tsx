import { Suspense } from "react";
import SignInForm from "./SignInForm";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <p className="text-ink-muted">불러오는 중...</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}