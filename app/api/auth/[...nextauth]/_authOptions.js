// app/api/auth/authOptions.js
import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: { params: { scope: "identify email guilds" } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) token.accessToken = account.access_token;
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
