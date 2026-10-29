import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// 로그인 필요한 경로들
const protectedRoutes = ["/dashboard", "/projects"];

// proxy의 역할: 모든 요청 앞단에서 도는 가벼운 1차 필터.
// 매 요청마다 DB를 조회하지 않도록 세션 쿠키의 "존재"만 본다 (서명·만료·DB 세션은 확인 안 함).
// 그래서 "쿠키 없음 → 확실히 비로그인"일 때만 판단에 쓰고, "쿠키 있음 → 로그인"이라고 믿고
// 내리는 결정은 여기서 하지 않는다. 서버에서 무효화된 세션(비밀번호 변경 등)도 쿠키는
// 남아 있을 수 있기 때문. 로그인한 사람을 /sign-in, /sign-up에서 내보내는 처리는
// 실제 세션을 확인하는 각 페이지(서버 컴포넌트)에서 한다.
export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // 로그인 안 했는데 보호된 경로 접근 → 로그인 페이지로
  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};