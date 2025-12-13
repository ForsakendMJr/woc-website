import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify email" } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Save Discord id/username on first login
      if (account && profile) {
        token.discordId = profile.id;
        token.discordName = profile.username;
        token.discordAvatar = profile.avatar;
      }
      return token;
    },
    async session({ session, token }) {
      session.discord = {
        id: token.discordId,
        username: token.discordName,
        avatar: token.discordAvatar,
      };
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
