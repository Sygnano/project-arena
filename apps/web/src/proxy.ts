import { type NextRequest, NextResponse } from "next/server";

const MAINTENANCE_PATH = "/maintenance";

/**
 * Maintenance mode, set with `MAINTENANCE_MODE=true` on this app and the API together while the
 * database is moved: every page redirects to /maintenance and this app's own API routes answer
 * 503, before anything calls the API. Once it's off, /maintenance sends visitors home.
 */
export function proxy(request: NextRequest) {
  const maintenance = process.env.MAINTENANCE_MODE === "true";
  const { pathname } = request.nextUrl;

  if (pathname === MAINTENANCE_PATH) {
    return maintenance ? NextResponse.next() : NextResponse.redirect(new URL("/", request.url));
  }
  if (!maintenance) return NextResponse.next();
  if (pathname.startsWith("/api/")) return Response.json({ error: "maintenance" }, { status: 503 });
  return NextResponse.redirect(new URL(MAINTENANCE_PATH, request.url));
}

export const config = {
  // Not the build's assets, public images or icons: the maintenance page needs them.
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico|icon.svg|apple-icon.png).*)"],
};
