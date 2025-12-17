import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify email guilds" } },
    }),
  ],
  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      // On first sign-in, store access token
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },

    async session({ session, token }) {
      // Make it available client-side (your dashboard uses this indirectly)
      session.accessToken = token?.accessToken || null;
      return session;
    },
  },
};
