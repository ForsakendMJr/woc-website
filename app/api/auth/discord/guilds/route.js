import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/_authOptions";

const PERM_ADMIN = 0x8;

function roleFromGuild(g) {
  if (g?.owner) return "Owner";
  const perms = Number(g?.permissions || 0);
  if ((perms & PERM_ADMIN) === PERM_ADMIN) return "Admin";
  return "Manager";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = session?.accessToken;

    if (!accessToken) {
      return NextResponse.json({
        source: "fallback",
        error: "No access token in server session. Check NextAuth callbacks.",
        guilds: [],
      });
    }

    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({
        source: "fallback",
        error: `Discord API error (${res.status}). ${txt}`.slice(0, 220),
        guilds: [],
      });
    }

    const raw = await res.json();

    const manageable = (Array.isArray(raw) ? raw : [])
      .filter(
        (g) =>
          g?.owner ||
          ((Number(g?.permissions || 0) & PERM_ADMIN) === PERM_ADMIN)
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ?? null,
        role: roleFromGuild(g),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      source: "live",
      error: "",
      guilds: manageable,
    });
  } catch (err) {
    return NextResponse.json({
      source: "fallback",
      error: (err?.message || "Unknown server error").slice(0, 220),
      guilds: [],
    });
  }
}
