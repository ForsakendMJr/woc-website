import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (profile?.id) token.discordId = profile.id;
      return token;
    },

    async session({ session, token }) {
      if (token?.accessToken) session.accessToken = token.accessToken;
      if (token?.discordId) session.discordId = token.discordId;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
