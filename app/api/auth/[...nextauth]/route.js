// app/api/auth/[...nextauth]/route.js
import { NextResponse } from "next/server";
import { createRequire } from "module";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // next-auth v4 should run on nodejs

const require = createRequire(import.meta.url);

// Handle both CJS + ESM default export shapes safely
const NextAuthImport = require("next-auth");
const NextAuth = NextAuthImport?.default ?? NextAuthImport;

const DiscordImport = require("next-auth/providers/discord");
const DiscordProvider = DiscordImport?.default ?? DiscordImport;

function getAuthOptions() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const secret = process.env.NEXTAUTH_SECRET;

  // IMPORTANT: Don't throw during build-time analysis.
  // If env vars are missing, we’ll return a clean 500 at runtime instead.
  if (!clientId || !clientSecret || !secret) return null;

  return {
    providers: [
      DiscordProvider({
        clientId,
        clientSecret,
        authorization: {
          params: {
            scope: "identify email guilds",
          },
        },
      }),
    ],
    secret,
    session: { strategy: "jwt" },
    callbacks: {
      async jwt({ token, account, profile }) {
        if (account) {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt = account.expires_at; // seconds
          token.provider = account.provider;
        }
        if (profile?.id) token.discordId = profile.id;
        return token;
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken || null;
        session.discordId = token.discordId || null;
        return session;
      },
    },
  };
}

// Create the NextAuth handler lazily (prevents "collect page data" build crash)
async function runNextAuth(req) {
  const opts = getAuthOptions();

  if (!opts) {
    return NextResponse.json(
      {
        error: "Missing auth env vars",
        need: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "NEXTAUTH_SECRET"],
      },
      { status: 500 }
    );
  }

  const handler = NextAuth(opts);
  return handler(req);
}

export async function GET(req) {
  return runNextAuth(req);
}

export async function POST(req) {
  return runNextAuth(req);
}
