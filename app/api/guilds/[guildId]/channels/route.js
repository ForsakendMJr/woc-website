import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const DISCORD_API = "https://discord.com/api/v10";

function getBotToken() {
  const token =
    process.env.DISCORD_BOT_TOKEN ||
    process.env.DISCORD_TOKEN ||
    process.env.DICSORD_BOT_TOKEN;

  const source = process.env.DISCORD_BOT_TOKEN
    ? "DISCORD_BOT_TOKEN"
    : process.env.DISCORD_TOKEN
    ? "DISCORD_TOKEN"
    : process.env.DICSORD_BOT_TOKEN
    ? "DICSORD_BOT_TOKEN"
    : null;

  return { token, source };
}

function isSnowflake(x) {
  return typeof x === "string" && /^\d{16,20}$/.test(x);
}

function typeLabel(t) {
  const map = {
    0: "Text",
    2: "Voice",
    4: "Category",
    5: "Announcement",
    13: "Stage",
    15: "Forum",
  };
  return map[t] || `Type ${t}`;
}

function extractGuildId(req, params) {
  const p = params?.guildId ? String(params.guildId) : "";
  if (isSnowflake(p)) return p;

  const q = req?.nextUrl?.searchParams?.get("guildId");
  if (isSnowflake(q || "")) return String(q);

  const pathname = String(req?.nextUrl?.pathname || "");
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((s) => s === "guilds");
  if (idx !== -1) {
    const maybe = parts[idx + 1] ? String(parts[idx + 1]) : "";
    if (isSnowflake(maybe)) return maybe;
  }

  return "";
}

export async function GET(req, { params } = {}) {
  const guildId = extractGuildId(req, params);

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      {
        ok: true,
        channels: [],
        guildId: "",
        bot_token_source: null,
        warning: "Missing guildId.",
        debug: {
          pathname: req?.nextUrl?.pathname || null,
          params: params || null,
          query_guildId: req?.nextUrl?.searchParams?.get("guildId") || null,
        },
      },
      { status: 200 }
    );
  }

  const { token: botToken, source } = getBotToken();
  if (!botToken) {
    return NextResponse.json(
      {
        ok: true,
        channels: [],
        guildId,
        bot_token_source: source,
        warning: "Missing bot token. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN).",
      },
      { status: 200 }
    );
  }

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return NextResponse.json(
      {
        ok: true,
        channels: [],
        guildId,
        bot_token_source: source,
        warning: `Channel fetch failed (${res.status}). ${txt}`.slice(0, 500),
      },
      { status: 200 }
    );
  }

  const raw = await res.json().catch(() => []);
  const list = Array.isArray(raw) ? raw : [];

  const categories = new Map();
  for (const c of list) {
    if (c?.type === 4) categories.set(String(c.id), c.name || "");
  }

  const channels = list
    .filter((c) => c && c.id && c.name && c.type !== 4)
    .map((c) => ({
      id: String(c.id),
      name: c.name,
      type: c.type,
      typeLabel: typeLabel(c.type),
      parentId: c.parent_id ? String(c.parent_id) : "",
      parentName: c.parent_id ? categories.get(String(c.parent_id)) || "" : "",
    }))
    .sort((a, b) => {
      const pa = (a.parentName || "").toLowerCase();
      const pb = (b.parentName || "").toLowerCase();
      if (pa !== pb) return pa.localeCompare(pb);
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

  return NextResponse.json(
    { ok: true, channels, guildId, bot_token_source: source, warning: "" },
    { status: 200 }
  );
}
