// app/api/auth/[...nextauth]/route.js
import NextAuthImport from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const runtime = "nodejs"; // ✅ next-auth v4 expects Node runtime

// ✅ Handles both CJS and ESM shapes after bundling
const NextAuth = NextAuthImport?.default ?? NextAuthImport;

if (typeof NextAuth !== "function") {
  throw new Error(
    `NextAuth import is not a function. Got: ${typeof NextAuth}. (CJS/ESM interop issue)`
  );
}

const handler = NextAuth({
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
    async jwt({ token, account }) {
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) session.accessToken = token.accessToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
