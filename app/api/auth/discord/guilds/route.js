// app/api/discord/guilds/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PERM_ADMIN = 0x8;

function roleFromGuild(g) {
  if (g?.owner) return "Owner";
  const perms = Number(g?.permissions || 0);
  if ((perms & PERM_ADMIN) === PERM_ADMIN) return "Admin";
  return "Manager";
}

export async function GET(req) {
  try {
    // Reads the NextAuth JWT cookie (server-side)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token?.accessToken) {
      return NextResponse.json(
        {
          guilds: [],
          source: "fallback",
          error:
            "No access token found in session. Make sure NextAuth jwt() callback stores account.access_token into token.accessToken, and redeploy/relogin.",
        },
        { status: 401 }
      );
    }

    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        {
          guilds: [],
          source: "fallback",
          error: `Discord guild fetch failed (${res.status}). ${txt?.slice(0, 220) || ""}`.trim(),
        },
        { status: 502 }
      );
    }

    const raw = await res.json();

    // Only show servers user can manage (Owner or Admin)
    const manageable = (Array.isArray(raw) ? raw : [])
      .filter(
        (g) => g?.owner || ((Number(g?.permissions || 0) & PERM_ADMIN) === PERM_ADMIN)
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ?? null,
        role: roleFromGuild(g),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        guilds: manageable,
        source: "live",
        error: "",
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      {
        guilds: [],
        source: "fallback",
        error: e?.message || "Unexpected error in /api/discord/guilds",
      },
      { status: 500 }
    );
  }
}
