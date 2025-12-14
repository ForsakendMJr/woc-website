import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          /**
           * identify  → basic user info
           * email     → optional but useful
           * guilds    → REQUIRED to fetch servers the user manages
           */
          scope: "identify email guilds",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    /**
     * Runs on sign-in & every token refresh
     * We persist the Discord access token so the dashboard
     * can call Discord APIs (/users/@me/guilds)
     */
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },

    /**
     * Makes accessToken available on the client:
     * session.accessToken
     */
    async session({ session, token }) {
      session.accessToken = token.accessToken ?? null;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
