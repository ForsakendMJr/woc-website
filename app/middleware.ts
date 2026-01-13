import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Allow welcome card image generation without auth
  if (
    pathname.startsWith("/api/guilds/") &&
    pathname.endsWith("/welcome-card.png")
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Apply middleware to everything EXCEPT static files,
     * but still allow us to short-circuit PNG routes above.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
