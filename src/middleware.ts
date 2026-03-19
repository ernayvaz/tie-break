import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "tb_session";

const protectedPaths = ["/schedule", "/leaderboard", "/predictions", "/rules"];
const adminPathPrefix = "/admin";
const authPaths = ["/login", "/register"];

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.has(SESSION_COOKIE_NAME);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAdmin = pathname.startsWith(adminPathPrefix);
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));
  const hasSession = hasSessionCookie(request);

  // Invite link: /invite/[token] – always allow
  if (pathname.startsWith("/invite/")) {
    return NextResponse.next();
  }

  // Protected user routes: require session cookie (actual validity checked server-side)
  if (isProtected && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  // Admin routes: require session cookie; role check is done in layout/page via requireAdmin()
  if (isAdmin && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  // If logged in and visiting login/register, redirect to schedule
  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/schedule", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/schedule/:path*",
    "/leaderboard/:path*",
    "/predictions/:path*",
    "/rules",
    "/rules/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/invite/:path*",
  ],
};
