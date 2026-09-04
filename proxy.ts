import { NextResponse, type NextRequest } from "next/server";

// Cheap first line of defense: redirect unauthenticated traffic to /login
// based on cookie presence only. Real validation (session row exists, not
// expired, user active, role) happens server-side in requireSession() on
// every page/action. /api/cron/reminders authenticates with its own bearer
// secret instead of a session cookie.
const PUBLIC = ["/login", "/api/login", "/api/cron/reminders"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = req.cookies.get("rental_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
