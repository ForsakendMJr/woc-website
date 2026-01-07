// app/api/discord/guilds/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";
const PERM_ADMIN = 0x8;

function roleFromGuild(g) {
  if (g?.owner) return "Owner";
  const perms = Number(g?.permissions || 0);
  if ((perms & PERM_ADMIN) === PERM_ADMIN) return "Admin";
  return "Manager";
}

function safeText(input, max = 220) {
  const s = String(input || "").trim();
  if (!s) return "";
  const looksLikeHtml =
    s.includes("<!DOCTYPE") || s.includes("<html") || s.includes("<body") || s.includes("<head");
  if (looksLikeHtml) return "Non-JSON/HTML response received.";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function GET(req) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const accessToken = token?.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { guilds: [], source: "none", error: "Not authenticated." },
        { status: 401 }
      );
    }

    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { guilds: [], source: "none", error: safeText(txt) },
        { status: 500 }
      );
    }

    const raw = await res.json().catch(() => []);
    const guilds = (Array.isArray(raw) ? raw : [])
      .filter((g) => g?.owner || ((Number(g?.permissions || 0) & PERM_ADMIN) === PERM_ADMIN))
      .map((g) => ({
        id: String(g.id),
        name: g.name,
        icon: g.icon ?? null,
        owner: !!g.owner,
        role: roleFromGuild(g),
      }))
      .sort((a, b) => (a.owner === b.owner ? a.name.localeCompare(b.name) : a.owner ? -1 : 1));

    return NextResponse.json({ guilds, source: "live" }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { guilds: [], source: "none", error: safeText(err?.message) },
      { status: 500 }
    );
  }
}
