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
  // Discord API v10 channel types (common ones)
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

export async function GET(_req, { params }) {
  const guildId = params?.guildId ? String(params.guildId) : "";
  if (!isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing guildId." }, { status: 400 });
  }

  const { token: botToken, source } = getBotToken();
  if (!botToken) {
    return NextResponse.json(
      {
        ok: false,
        bot_token_source: source,
        error: "Missing bot token. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN).",
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
      { ok: false, error: `Channel fetch failed (${res.status}). ${txt}`.slice(0, 500) },
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
      // group by category name then channel name
      const pa = (a.parentName || "").toLowerCase();
      const pb = (b.parentName || "").toLowerCase();
      if (pa !== pb) return pa.localeCompare(pb);
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

  return NextResponse.json({ ok: true, channels }, { status: 200 });
}
