import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
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

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      if (profile?.id) {
        token.discordId = profile.id;
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token?.accessToken ?? null;
      session.discordId = token?.discordId ?? null;
      return session;
    },
  },
};
