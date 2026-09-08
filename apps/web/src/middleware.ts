import { NextResponse, type NextRequest } from "next/server";
import { authorize } from "./lib/server-auth";
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const managerOnly =
    /^\/(dashboard|audit|reports)(\/|$)/.test(path) ||
    /^\/api\/(dashboard|audit)(\/|$)/.test(path);
  const result = await authorize(request, managerOnly);
  if ("response" in result) {
    if (path.startsWith("/api/") || result.response.status === 503)
      return result.response;
    const url = new URL(
      result.response.status === 401 ? "/login" : "/access-denied",
      request.url,
    );
    url.searchParams.set("redirect", path + request.nextUrl.search);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/audit/:path*",
    "/reports/:path*",
    "/contacts/:path*",
    "/chat/:path*",
    "/chatwoot-widget/:path*",
    "/api/dashboard/:path*",
    "/api/audit/:path*",
  ],
};
