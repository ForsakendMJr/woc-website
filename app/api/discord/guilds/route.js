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

function safeText(input, max = 280) {
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
        { guilds: [], source: "none", error: "Not authenticated (missing access token)." },
        { status: 401 }
      );
    }

    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const bodyText = await res.text().catch(() => "");

    // If Discord says no, forward that status (401/403/etc) so UI can react correctly.
    if (!res.ok) {
      // Try JSON first for nice errors
      if (ct.includes("application/json")) {
        const json = (() => {
          try {
            return JSON.parse(bodyText);
          } catch {
            return null;
          }
        })();

        return NextResponse.json(
          {
            guilds: [],
            source: "none",
            error: json?.message || safeText(bodyText) || `Discord error (${res.status})`,
            discord: json || null,
          },
          { status: res.status }
        );
      }

      return NextResponse.json(
        { guilds: [], source: "none", error: safeText(bodyText) || `Discord error (${res.status})` },
        { status: res.status }
      );
    }

    // Success JSON
    const raw = (() => {
      try {
        return JSON.parse(bodyText);
      } catch {
        return [];
      }
    })();

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
      { guilds: [], source: "none", error: safeText(err?.message || err) },
      { status: 500 }
    );
  }
}
