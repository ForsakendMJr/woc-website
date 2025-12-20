import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const keys = ["DISCORD_TOKEN", "DISCORD_BOT_TOKEN", "DICSORD_BOT_TOKEN"];
  const present = Object.fromEntries(
    keys.map((k) => [k, !!process.env[k]])
  );

  return NextResponse.json({
    ok: true,
    present,
    // helpful: shows which deployment/environment you’re hitting
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
  });
}
