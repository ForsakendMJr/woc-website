import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    present: {
      DISCORD_BOT_TOKEN: Boolean(process.env.DISCORD_BOT_TOKEN),
      DISCORD_TOKEN: Boolean(process.env.DISCORD_TOKEN),
      DICSORD_BOT_TOKEN: Boolean(process.env.DICSORD_BOT_TOKEN),
      NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    },
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
  });
}
