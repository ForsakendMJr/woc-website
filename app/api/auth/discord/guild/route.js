// // app/api/discord/guilds/route.js
// import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt";

// export const dynamic = "force-dynamic";

// const PERM_ADMIN = 0x8; // Administrator bit
// const DISCORD_API = "https://discord.com/api";

// function roleFromGuild(g) {
//   if (g?.owner) return "Owner";
//   const perms = Number(g?.permissions || 0);
//   if ((perms & PERM_ADMIN) === PERM_ADMIN) return "Admin";
//   return "Manager";
// }

// export async function GET(req) {
//   try {
//     // Pull the NextAuth JWT from cookies (server-side)
//     const token = await getToken({
//       req,
//       secret: process.env.NEXTAUTH_SECRET,
//     });

//     const accessToken = token?.accessToken;

//     if (!accessToken) {
//       return NextResponse.json(
//         { guilds: [], source: "none", error: "Not authenticated (no access token)." },
//         { status: 401 }
//       );
//     }

//     const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
//       headers: { Authorization: `Bearer ${accessToken}` },
//       cache: "no-store",
//     });

//     if (!res.ok) {
//       const txt = await res.text().catch(() => "");
//       return NextResponse.json(
//         {
//           guilds: [],
//           source: "none",
//           error: `Discord guild fetch failed (${res.status}). ${txt}`.trim(),
//         },
//         { status: 500 }
//       );
//     }

//     const raw = await res.json();

//     // Keep only servers they can manage (Owner or Admin)
//     const guilds = (Array.isArray(raw) ? raw : [])
//       .filter(
//         (g) =>
//           g?.owner ||
//           ((Number(g?.permissions || 0) & PERM_ADMIN) === PERM_ADMIN)
//       )
//       .map((g) => ({
//         id: String(g.id),
//         name: g.name,
//         icon: g.icon ?? null,
//         owner: !!g.owner,
//         role: roleFromGuild(g),
//       }))
//       .sort((a, b) =>
//         a.owner === b.owner ? a.name.localeCompare(b.name) : a.owner ? -1 : 1
//       );

//     return NextResponse.json({ guilds, source: "live" }, { status: 200 });
//   } catch (err) {
//     return NextResponse.json(
//       { guilds: [], source: "none", error: err?.message || "Unknown error." },
//       { status: 500 }
//     );
//   }
// }
