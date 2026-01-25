import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- helpers ---
function qp(url, key, fallback = "") {
  const v = url.searchParams.get(key);
  return v == null || v === "" ? fallback : v;
}

function clamp(n, min, max) {
  n = Number(n);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchAsDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function truncate(s, max = 48) {
  s = String(s || "");
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

export async function GET(req) {
  try {
    const url = new URL(req.url);

    // --- match your UI fields ---
    const backgroundImageUrl = qp(url, "backgroundImageUrl", qp(url, "background", ""));
    const title = truncate(qp(url, "title", "Welcome!"), 54);
    const subtitle = truncate(qp(url, "subtitle", ""), 60);

    const bgColor = qp(url, "backgroundColor", "#0b1020");
    const textColor = qp(url, "textColor", "#ffffff");
    const overlayOpacity = clamp(qp(url, "overlayOpacity", "0.35"), 0, 0.85);

    const showAvatar = qp(url, "showAvatar", "true") !== "false";

    // Your existing params still supported (so nothing breaks)
    const username = truncate(qp(url, "username", ""), 36);
    const serverName = truncate(qp(url, "serverName", ""), 40);
    const memberCount = qp(url, "membercount", qp(url, "memberCount", ""));

    const avatarUrl = qp(url, "avatarUrl", "");
    const serverIconUrl = qp(url, "serverIconUrl", "");

    // Best “Discord card” size
    const W = 1200;
    const H = 420;

    // Fetch images (embed into SVG as data URIs for reliable sharp rendering)
    const [bgData, avatarData, iconData] = await Promise.all([
      fetchAsDataUri(backgroundImageUrl),
      showAvatar ? fetchAsDataUri(avatarUrl) : Promise.resolve(null),
      fetchAsDataUri(serverIconUrl),
    ]);

    // Strong Linux-safe font stack (fixes the tofu squares)
    const FONT_STACK = "DejaVu Sans, Noto Sans, Liberation Sans, Arial, sans-serif";

    // Slightly smarter text: if frontend didn’t replace templates, we can still show useful content
    const primaryLine = esc(title.replaceAll("{user.name}", username || "New member"));
    const secondaryLine = esc(
      subtitle
        .replaceAll("{membercount}", memberCount || "?")
        .replaceAll("{server.name}", serverName || "this server")
    );

    const svg = `
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${bgColor}"/>
            <stop offset="100%" stop-color="#060814"/>
          </linearGradient>

          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity="0.35"/>
          </filter>

          <clipPath id="avatarClip">
            <circle cx="172" cy="210" r="86"/>
          </clipPath>

          <clipPath id="iconClip">
            <circle cx="1088" cy="92" r="38"/>
          </clipPath>
        </defs>

        <!-- Base background -->
        <rect x="0" y="0" width="${W}" height="${H}" rx="30" fill="url(#base)"/>

        <!-- Optional background image -->
        ${
          bgData
            ? `<image href="${bgData}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="1"/>`
            : ""
        }

        <!-- Overlay to keep text readable -->
        <rect x="0" y="0" width="${W}" height="${H}" rx="30" fill="rgba(0,0,0,${overlayOpacity})"/>

        <!-- Accent bar -->
        <rect x="28" y="28" width="10" height="${H - 56}" rx="5" fill="#8b5cf6" opacity="0.95"/>

        <!-- Card panel -->
        <rect x="64" y="62" width="${W - 128}" height="${H - 124}" rx="26" fill="rgba(255,255,255,0.07)" filter="url(#softShadow)"/>

        <!-- Avatar block -->
        ${
          avatarData
            ? `
            <circle cx="172" cy="210" r="96" fill="rgba(255,255,255,0.10)"/>
            <circle cx="172" cy="210" r="92" fill="rgba(0,0,0,0.20)"/>
            <image href="${avatarData}" x="86" y="124" width="172" height="172" clip-path="url(#avatarClip)"/>
          `
            : `
            <circle cx="172" cy="210" r="86" fill="rgba(255,255,255,0.12)"/>
          `
        }

        <!-- Server icon -->
        ${
          iconData
            ? `
            <circle cx="1088" cy="92" r="44" fill="rgba(255,255,255,0.10)"/>
            <image href="${iconData}" x="1050" y="54" width="76" height="76" clip-path="url(#iconClip)"/>
          `
            : ""
        }

        <!-- Text -->
        <text x="320" y="185" font-size="44" font-weight="800" fill="${textColor}" font-family="${FONT_STACK}">
          ${primaryLine}
        </text>

        <text x="320" y="232" font-size="22" font-weight="600" fill="${textColor}" opacity="0.88" font-family="${FONT_STACK}">
          ${secondaryLine}
        </text>

        <!-- Tiny meta line -->
        <text x="320" y="275" font-size="18" fill="${textColor}" opacity="0.70" font-family="${FONT_STACK}">
          ${esc(serverName ? `Server: ${serverName}` : "")}
        </text>

        <text x="320" y="304" font-size="18" fill="${textColor}" opacity="0.70" font-family="${FONT_STACK}">
          ${esc(memberCount ? `Member #${memberCount}` : "")}
        </text>

        <!-- Footer -->
        <text x="${W - 84}" y="${H - 48}" text-anchor="end" font-size="16" fill="${textColor}" opacity="0.55" font-family="${FONT_STACK}">
          WoC • Welcome Card
        </text>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[welcome-card] render error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
