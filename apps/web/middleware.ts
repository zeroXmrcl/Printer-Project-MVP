import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { securityHeaders } from "./lib/security-headers";

export function middleware(request: NextRequest) {
  const existing = request.cookies.get("printcast_csrf")?.value;
  const token = existing ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-printcast-csrf", token);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const secure = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  for (const [name, value] of Object.entries(securityHeaders(secure))) response.headers.set(name, value);
  if (!existing) {
    response.cookies.set("printcast_csrf", token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
