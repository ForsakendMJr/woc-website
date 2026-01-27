// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(_req) {
    // no-op: withAuth handles redirects
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;

        // ✅ ALWAYS allow Stripe webhooks (no auth, no redirects)
        if (pathname === "/api/stripe/webhook") {
          return true;
        }

        // ✅ ALWAYS allow welcome card PNG endpoint
        if (
          pathname.startsWith("/api/guilds/") &&
          pathname.endsWith("/welcome-card.png")
        ) {
          return true;
        }

        // 🔒 Everything else requires auth
        return !!token;
      },
    },
  }
);

// Only protect what actually needs protection
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/discord/:path*",
    "/api/guilds/:path*",
  ],
};
