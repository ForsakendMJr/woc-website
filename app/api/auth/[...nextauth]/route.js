import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          // ✅ guilds needed for /users/@me/guilds
          scope: "identify email guilds",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      // Store access token so server routes can call Discord
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },

    async session({ session, token }) {
      // Expose it if you want, but the API route uses getToken() anyway
      session.accessToken = token.accessToken || null;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
