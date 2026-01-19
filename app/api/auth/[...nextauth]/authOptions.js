// app/api/auth/[...nextauth]/authOptions.js
import DiscordProvider from "next-auth/providers/discord";

/**
 * IMPORTANT:
 * Do NOT throw on import. Vercel/Next may import this during build/collect.
 * We read env lazily inside getAuthOptions().
 */

function env(name) {
  return (process.env[name] || "").trim();
}

export function getAuthOptions() {
  const NEXTAUTH_SECRET = env("NEXTAUTH_SECRET");
  const DISCORD_CLIENT_ID = env("DISCORD_CLIENT_ID");
  const DISCORD_CLIENT_SECRET = env("DISCORD_CLIENT_SECRET");

  if (!NEXTAUTH_SECRET || !DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error(
      `Missing env vars: ${
        !NEXTAUTH_SECRET ? "NEXTAUTH_SECRET " : ""
      }${!DISCORD_CLIENT_ID ? "DISCORD_CLIENT_ID " : ""}${
        !DISCORD_CLIENT_SECRET ? "DISCORD_CLIENT_SECRET " : ""
      }`
    );
  }

  return {
    secret: NEXTAUTH_SECRET,
    providers: [
      DiscordProvider({
        clientId: DISCORD_CLIENT_ID,
        clientSecret: DISCORD_CLIENT_SECRET,
        authorization: { params: { scope: "identify email guilds" } },
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
}

