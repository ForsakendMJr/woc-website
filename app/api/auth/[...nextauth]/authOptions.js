import DiscordProvider from "next-auth/providers/discord";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const authOptions = {
  secret: mustEnv("NEXTAUTH_SECRET"),

  providers: [
    DiscordProvider({
      clientId: mustEnv("DISCORD_CLIENT_ID"),
      clientSecret: mustEnv("DISCORD_CLIENT_SECRET"),
      authorization: {
        params: {
          scope: "identify guilds email",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (account?.token_type) token.tokenType = account.token_type;
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token?.accessToken || null;
      session.tokenType = token?.tokenType || "Bearer";
      return session;
    },
  },
};
