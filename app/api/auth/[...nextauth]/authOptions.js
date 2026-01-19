// app/api/auth/[...nextauth]/authOptions.js
import DiscordProvider from "next-auth/providers/discord";

// Build-safe: do NOT throw if envs are missing during build
const hasDiscordEnv =
  !!process.env.DISCORD_CLIENT_ID && !!process.env.DISCORD_CLIENT_SECRET;

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: hasDiscordEnv
    ? [
        DiscordProvider({
          clientId: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          authorization: { params: { scope: "identify email guilds" } },
        }),
      ]
    : [],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
