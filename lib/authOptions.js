import DiscordProvider from "next-auth/providers/discord";

// Centralised NextAuth options.
// IMPORTANT: Do NOT export these from the route handler file itself.
// Next.js App Router route modules may only export GET/POST + a few route-level flags.

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      // We NEED guilds to build the dashboard guild list.
      authorization: { params: { scope: "identify email guilds" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist Discord access token on the JWT
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) session.accessToken = token.accessToken;
      return session;
    },
  },
};
