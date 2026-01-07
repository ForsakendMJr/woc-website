// app/api/auth/discord/guilds/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/_authOptions";

export const dynamic = "force-dynamic";

/**
 * Optional helper endpoint.
 * If you don't need it, you can delete the whole folder:
 * app/api/auth/discord/guilds/
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  return NextResponse.json(
    { ok: !!session, user: session?.user ?? null },
    { status: 200 }
  );
}
