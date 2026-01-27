// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(_req) {
    // no-op: withAuth handles redirects for protected routes
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;

        // ✅ Always allow Stripe webhook (no auth, no redirects)
        if (pathname === "/api/stripe/webhook") return true;

        // ✅ Always allow welcome card PNG endpoint
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

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/discord/:path*",
    "/api/guilds/:path*",
    // (optional but safe) if you later protect more APIs, Stripe is still allowed above
    "/api/stripe/:path*",
  ],
};
