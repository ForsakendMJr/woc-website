import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: { scope: "identify email guilds" },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account, profile }) {
      // access token for API calls (guilds, etc.)
      if (account?.access_token) token.accessToken = account.access_token;

      // Discord user id (snowflake)
      if (profile?.id) token.discordId = profile.id;

      // fallback: token.sub is often the provider user id
      if (!token.discordId && token?.sub) token.discordId = token.sub;

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token?.accessToken ?? null;

      // Ensure session.user exists
      session.user ||= {};

      // Put the Discord snowflake where most code expects it
      session.user.id = token?.discordId ?? token?.sub ?? null;

      // Optional: keep your convenience field too
      session.discordId = session.user.id;

      return session;
    },
  },
};
