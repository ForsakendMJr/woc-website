import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "../_authOptions";

// If you don't have authOptions file yet, skip this and use inline options below.
// (I’ll provide the clean authOptions file in step 2.1)

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch guilds", status: res.status },
      { status: 500 }
    );
  }

  const guilds = await res.json();

  // Filter: show only guilds where user likely can manage
  // Manage Guild = 0x20 (32), Administrator = 0x8 (8)
  const MANAGE_GUILD = 1 << 5; // 32
  const ADMINISTRATOR = 1 << 3; // 8

  const manageable = (guilds || []).filter((g) => {
    const perms = Number(g.permissions) || 0;
    return (perms & MANAGE_GUILD) === MANAGE_GUILD || (perms & ADMINISTRATOR) === ADMINISTRATOR;
  });

  return NextResponse.json({ guilds: manageable });
}
