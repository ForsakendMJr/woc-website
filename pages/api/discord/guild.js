// pages/api/discord/guilds.js
import { getToken } from "next-auth/jwt";

const PERM_ADMIN = 0x8;

function roleFromGuild(g) {
  if (g?.owner) return "Owner";
  const perms = Number(g?.permissions || 0);
  if ((perms & PERM_ADMIN) === PERM_ADMIN) return "Admin";
  return "Manager";
}

export default async function handler(req, res) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const accessToken = token?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        guilds: [],
        source: "none",
        error: "Not authenticated (no access token).",
      });
    }

    const r = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(500).json({
        guilds: [],
        source: "none",
        error: `Discord guild fetch failed (${r.status}). ${txt}`.trim(),
      });
    }

    const raw = await r.json();

    const guilds = (Array.isArray(raw) ? raw : [])
      .filter(
        (g) =>
          g?.owner ||
          ((Number(g?.permissions || 0) & PERM_ADMIN) === PERM_ADMIN)
      )
      .map((g) => ({
        id: String(g.id),
        name: g.name,
        icon: g.icon ?? null,
        owner: !!g.owner,
        role: roleFromGuild(g),
      }))
      .sort((a, b) =>
        a.owner === b.owner ? a.name.localeCompare(b.name) : a.owner ? -1 : 1
      );

    return res.status(200).json({ guilds, source: "live" });
  } catch (err) {
    return res.status(500).json({
      guilds: [],
      source: "none",
      error: err?.message || "Unknown error.",
    });
  }
}
