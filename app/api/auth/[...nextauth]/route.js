import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  // MUST be set on Vercel + local
  secret: process.env.NEXTAUTH_SECRET,

  // Turn on logs so you can see what's happening in Vercel logs
  debug: true,

  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          // IMPORTANT
          scope: "identify email guilds",
          prompt: "none",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      // On the FIRST login, account exists and contains Discord access_token
      if (account) {
        token.accessToken = account.access_token ?? token.accessToken ?? null;
        token.tokenType = account.token_type ?? token.tokenType ?? null;
        token.provider = account.provider ?? token.provider ?? "discord";
      }
      return token;
    },

    async session({ session, token }) {
      // Put access token onto session (client can read it)
      session.accessToken = token.accessToken ?? null;
      session.tokenType = token.tokenType ?? null;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
