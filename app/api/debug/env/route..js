import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const keys = ["DISCORD_BOT_TOKEN", "DISCORD_TOKEN", "DICSORD_BOT_TOKEN"];
  const present = Object.fromEntries(keys.map((k) => [k, Boolean(process.env[k])]));

  return NextResponse.json({
    ok: true,
    present,
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
  });
}
