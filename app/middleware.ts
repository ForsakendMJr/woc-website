import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // no-op: withAuth handles redirects for protected routes
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;

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
// ✅ Do NOT blanket-match everything if you don’t need to.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/discord/:path*",
    "/api/guilds/:path*",
  ],
};
