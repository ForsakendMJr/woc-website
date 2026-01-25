import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function q(url, key, fallback = "") {
  return url.searchParams.get(key) ?? fallback;
}

async function fetchAsDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  }
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(req) {
  try {
    const url = new URL(req.url);

    // Your query params (based on your screenshot)
    const serverName = esc(q(url, "serverName", "Web of Communities"));
    const username = esc(q(url, "username", "New Member"));
    const subtitle = esc(q(url, "subtitle", "just joined the server"));
    const memberCount = esc(q(url, "membercount", "1"));

    const avatarUrl = q(url, "avatarUrl", "");
    const serverIconUrl = q(url, "serverIconUrl", "");

    // Optional styling params (you can keep using your current ones)
    const backgroundColor = q(url, "backgroundColor", "#0b1020");
    const textColor = q(url, "textColor", "#ffffff");
    const accentColor = q(url, "accentColor", "#8b5cf6"); // violet-ish

    // Fetch images and embed as data URIs so sharp can render them reliably
    const [avatarData, iconData] = await Promise.all([
      fetchAsDataUri(avatarUrl),
      fetchAsDataUri(serverIconUrl),
    ]);

    // Canvas size (tweak if your UI expects different)
    const W = 1100;
    const H = 360;

    // Simple SVG layout -> sharp converts to PNG
    const svg = `
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${backgroundColor}"/>
            <stop offset="100%" stop-color="#060814"/>
          </linearGradient>

          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/>
          </filter>

          <clipPath id="circleClip">
            <circle cx="130" cy="180" r="78"/>
          </clipPath>
          <clipPath id="iconClip">
            <circle cx="980" cy="72" r="34"/>
          </clipPath>
        </defs>

        <!-- Background -->
        <rect x="0" y="0" width="${W}" height="${H}" rx="28" fill="url(#bg)"/>

        <!-- Accent bar -->
        <rect x="28" y="28" width="10" height="${H - 56}" rx="5" fill="${accentColor}" opacity="0.9"/>

        <!-- Card surface -->
        <rect x="60" y="52" width="${W - 120}" height="${H - 104}" rx="24" fill="rgba(255,255,255,0.06)" filter="url(#softShadow)"/>

        <!-- Avatar ring -->
        <circle cx="130" cy="180" r="86" fill="rgba(255,255,255,0.08)"/>
        <circle cx="130" cy="180" r="82" fill="rgba(0,0,0,0.15)"/>

        ${avatarData ? `
          <image href="${avatarData}" x="52" y="102" width="156" height="156" clip-path="url(#circleClip)"/>
        ` : `
          <circle cx="130" cy="180" r="78" fill="rgba(255,255,255,0.12)"/>
          <text x="130" y="190" text-anchor="middle" font-size="44" fill="${textColor}" opacity="0.85" font-family="Arial, sans-serif">?</text>
        `}

        <!-- Server icon -->
        ${iconData ? `
          <circle cx="980" cy="72" r="38" fill="rgba(255,255,255,0.10)"/>
          <image href="${iconData}" x="946" y="38" width="68" height="68" clip-path="url(#iconClip)"/>
        ` : ""}

        <!-- Text -->
        <text x="240" y="140" font-size="42" font-weight="800" fill="${textColor}" font-family="Arial, sans-serif">
          Welcome, ${username}
        </text>

        <text x="240" y="182" font-size="22" font-weight="600" fill="${textColor}" opacity="0.85" font-family="Arial, sans-serif">
          ${subtitle}
        </text>

        <text x="240" y="222" font-size="18" fill="${textColor}" opacity="0.7" font-family="Arial, sans-serif">
          Server: ${serverName}
        </text>

        <text x="240" y="254" font-size="18" fill="${textColor}" opacity="0.7" font-family="Arial, sans-serif">
          Member count: ${memberCount}
        </text>

        <!-- Footer -->
        <text x="${W - 80}" y="${H - 44}" text-anchor="end" font-size="16" fill="${textColor}" opacity="0.55" font-family="Arial, sans-serif">
          WoC • Welcome Card
        </text>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toBuffer();

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[welcome-card] render error:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
