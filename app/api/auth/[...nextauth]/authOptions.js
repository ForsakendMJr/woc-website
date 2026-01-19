import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

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
      // Persist OAuth access_token to the token right after signin
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      // Expose accessToken to the client so your /api/discord/guilds can use it
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
