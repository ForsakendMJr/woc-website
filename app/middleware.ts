import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // withAuth handles redirects for protected routes
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;

        // ✅ ALWAYS allow Stripe webhooks (Stripe will NOT follow redirects)
        if (pathname.startsWith("/api/stripe/webhook")) {
          return true;
        }

        // ✅ (Optional) allow any stripe routes you may add later
        if (pathname.startsWith("/api/stripe/")) {
          return true;
        }

        // ✅ ALWAYS allow the welcome card PNG route (and its debug mode)
        // /api/guilds/<guildId>/welcome-card.png
        if (
          pathname.startsWith("/api/guilds/") &&
          pathname.endsWith("/welcome-card.png")
        ) {
          return true;
        }

        // Everything else matched requires auth
        return !!token;
      },
    },
  }
);

// Only run middleware on dashboard + the APIs you actually want protected.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/discord/:path*",
    "/api/guilds/:path*",
    // 🚫 Do NOT add "/api/stripe/:path*" here unless you *want* auth checks on it
  ],
};
