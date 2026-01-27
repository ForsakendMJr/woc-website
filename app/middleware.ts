// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {},
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;

        // ✅ always allow Stripe webhooks
        if (pathname === "/api/stripe/webhook") return true;

        // ✅ allow welcome card png
        if (
          pathname.startsWith("/api/guilds/") &&
          pathname.endsWith("/welcome-card.png")
        ) return true;

        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/api/discord/:path*", "/api/guilds/:path*"],
};
