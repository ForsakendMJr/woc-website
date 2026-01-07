// app/api/auth/discord/guilds/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../[...nextauth]/_authOptions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  // Just a small helper endpoint, if you still want it:
  return NextResponse.json(
    {
      ok: !!session,
      user: session?.user ?? null,
    },
    { status: 200 }
  );
}
