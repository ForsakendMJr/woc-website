// app/api/discord/guilds/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";
const PERM_ADMIN = 0x8;

// Small in-memory cache per serverless instance (helps with Strict Mode double-fetches)
const CACHE_TTL_MS = 30 * 1000;
const cache = globalThis.__wocGuildCache || (globalThis.__wocGuildCache = new Map());

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
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = token?.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { guilds: [], source: "none", error: "Not authenticated." },
        { status: 401 }
      );
    }

    const userKey = token?.sub || token?.id || "me";
    const cacheKey = `guilds:${userKey}`;
    const now = Date.now();

    const hit = cache.get(cacheKey);
    if (hit && hit.exp > now) {
      return NextResponse.json({ ...hit.data, source: "cache" }, { status: 200 });
    }

    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    // Soft-handle Discord rate limits: return 200 + warning (so your UI doesn’t show scary “Error ⚠️”)
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const retryAfter = Number(body?.retry_after || 1);

      const stale = hit?.data?.guilds?.length ? hit.data : { guilds: [], source: "none" };

      return NextResponse.json(
        {
          ...stale,
          source: stale.guilds?.length ? "cache-stale" : "none",
          warning: `Discord rate-limited guild list. Try again in ~${Math.ceil(retryAfter)}s.`,
          retry_after: retryAfter,
        },
        { status: 200 }
      );
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { guilds: [], source: "none", error: safeText(`Discord guild fetch failed (${res.status}). ${txt}`) },
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

    const payload = { guilds, source: "live" };
    cache.set(cacheKey, { exp: now + CACHE_TTL_MS, data: payload });

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { guilds: [], source: "none", error: safeText(err?.message || "Unknown error.") },
      { status: 500 }
    );
  }
}
