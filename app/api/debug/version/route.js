import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    fingerprint: "woc-debug-version-001",
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
    vercelUrl: process.env.VERCEL_URL || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}
