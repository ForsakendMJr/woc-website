import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function info(key) {
  const v = process.env[key];
  return {
    present: v !== undefined,
    length: typeof v === "string" ? v.length : 0,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    DISCORD_BOT_TOKEN: info("DISCORD_BOT_TOKEN"),
    DISCORD_TOKEN: info("DISCORD_TOKEN"),
    DICSORD_BOT_TOKEN: info("DICSORD_BOT_TOKEN"),
    NEXTAUTH_SECRET: info("NEXTAUTH_SECRET"),
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
  });
}
