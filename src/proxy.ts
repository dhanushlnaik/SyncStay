import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/inventory",
  "/bookings",
  "/channels",
  "/sync-logs",
  "/simulation",
  "/settings",
  "/onboarding",
  "/admin/onboarding",
  "/admin/users",
  "/reliability",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSessionToken = Boolean(request.cookies.get("better-auth.session_token")?.value);
  if (hasSessionToken) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/auth/sign-in";
  url.searchParams.set("from", pathname);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventory/:path*",
    "/bookings/:path*",
    "/channels/:path*",
    "/sync-logs/:path*",
    "/simulation/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/admin/onboarding/:path*",
    "/admin/users/:path*",
    "/reliability/:path*",
  ],
};
