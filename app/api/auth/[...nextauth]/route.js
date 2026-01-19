// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const dynamic = "force-dynamic";

// ✅ NextAuth v4 + App Router: export a handler as GET/POST
export const authOptions = {
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
      // Persist OAuth tokens to the JWT
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // seconds
        token.provider = account.provider;
      }
      if (profile) {
        token.discordId = profile.id;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose token fields to the client
      session.accessToken = token.accessToken || null;
      session.discordId = token.discordId || null;
      return session;
    },
  },

  // Optional: helps when deploying across domains/subdomains
  // cookies: { ... } // leave alone unless you need it
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
