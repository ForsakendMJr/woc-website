// app/api/discord/guilds/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Returns the user's Discord guilds using the OAuth access_token stored by NextAuth.
 * Requires Discord OAuth scope: "guilds"
 *
 * Response:
 * {
 *   ok: true,
 *   guilds: [{ id, name, icon, owner, permissions, manageable }]
 * }
 */
export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    const accessToken = token?.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_ACCESS_TOKEN",
          message: "No access token found. Sign in again and ensure guilds scope is enabled.",
        },
        { status: 401 }
      );
    }

    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      // avoid caching issues
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: "DISCORD_API_ERROR",
          status: res.status,
          message: "Discord API rejected the request.",
          details: text?.slice(0, 300) || null,
        },
        { status: 502 }
      );
    }

    const guilds = await res.json();

    // Discord permissions are strings in API response sometimes; normalize to BigInt-safe parsing
    const MANAGE_GUILD = 1n << 5n; // 0x20
    const ADMINISTRATOR = 1n << 3n; // 0x8

    const normalized = (Array.isArray(guilds) ? guilds : []).map((g) => {
      const perm = BigInt(g?.permissions ?? "0");
      const manageable = g?.owner === true || (perm & MANAGE_GUILD) !== 0n || (perm & ADMINISTRATOR) !== 0n;

      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner: !!g.owner,
        permissions: String(g.permissions ?? "0"),
        manageable,
      };
    });

    // Put manageable guilds first (nice UX)
    normalized.sort((a, b) => Number(b.manageable) - Number(a.manageable));

    return NextResponse.json({ ok: true, guilds: normalized }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_ERROR",
        message: err?.message || "Unknown server error",
      },
      { status: 500 }
    );
  }
}
