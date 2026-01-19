// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const dynamic = "force-dynamic";

// ❌ DO NOT export authOptions from a Route file.
// ✅ Keep it as a local const instead.
const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // seconds
        token.provider = account.provider;
      }
      if (profile) token.discordId = profile.id;
      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken || null;
      session.discordId = token.discordId || null;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
