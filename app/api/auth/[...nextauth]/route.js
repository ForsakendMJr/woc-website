import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          // IMPORTANT: "guilds" is what allows /users/@me/guilds
          scope: "identify email guilds",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      // When the user signs in, Discord gives us an access_token
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },

    async session({ session, token }) {
      // Put it onto the session so the client (dashboard) can use it
      session.accessToken = token.accessToken || null;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
