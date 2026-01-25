// src/app/api/guilds/[guildId]/welcome-card.png/route.js
import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";          // canvas/sharp needs node runtime
export const dynamic = "force-dynamic";   // no caching while debugging

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

function truncate(s, max = 48) {
  s = String(s || "");
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + "…";
}

async function readPublicFontBase64(fileName) {
  try {
    const abs = path.join(process.cwd(), "public", "fonts", fileName);
    const buf = await fs.readFile(abs);
    return buf.toString("base64");
  } catch {
    return null;
  }
}

async function fetchAsDataUri(url) {
  if (!url) return null;

  // prevent silly huge requests
  const MAX_BYTES = 8 * 1024 * 1024; // 8MB

  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // some CDNs require referer-like behavior
        "Referer": url,
      },
    });

    if (!res.ok) {
      // Helpful for debugging in logs (you can remove later)
      console.log("[welcome-card] fetch blocked:", res.status, url);
      return null;
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("image/")) return null;

    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) return null;

    const buf = Buffer.from(ab);
    return `data:${ct || "image/png"};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function localPublicImageDataUri(origin, publicPath) {
  // Fetch from our own server so it works on Vercel too
  // Example: /backgrounds/welcome.jpg
  try {
    const url = `${origin}${publicPath.startsWith("/") ? publicPath : `/${publicPath}`}`;
    return await fetchAsDataUri(url);
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url);

    // Support your UI param names
    const backgroundImageUrl =
      qp(url, "backgroundUrl", "") ||
      qp(url, "backgroundImageUrl", "") ||
      qp(url, "background", "");

    const title = truncate(qp(url, "title", "Welcome!"), 54);
    const subtitle = truncate(qp(url, "subtitle", ""), 60);

    const bgColor = qp(url, "backgroundColor", "#0b1020");
    const textColor = qp(url, "textColor", "#ffffff");
    const overlayOpacity = clamp(qp(url, "overlayOpacity", "0.35"), 0, 0.85);

    const showAvatar = qp(url, "showAvatar", "true") !== "false";

    const username = truncate(qp(url, "username", ""), 36);
    const serverName = truncate(qp(url, "serverName", ""), 40);
    const memberCount = qp(url, "membercount", qp(url, "memberCount", ""));

    const avatarUrl = qp(url, "avatarUrl", "");
    const serverIconUrl = qp(url, "serverIconUrl", "");

    // Canvas
    const W = 1200;
    const H = 420;

    // ✅ Reliable font loading from /public/fonts
    const interRegular = await readPublicFontBase64("Inter-Regular.ttf");
    const interBold = await readPublicFontBase64("Inter-ExtraBold.ttf");

    const fontCss = interRegular
      ? `
        @font-face {
          font-family: "InterEmbed";
          src: url("data:font/ttf;base64,${interRegular}") format("truetype");
          font-weight: 400;
          font-style: normal;
        }
        ${interBold ? `
        @font-face {
          font-family: "InterEmbed";
          src: url("data:font/ttf;base64,${interBold}") format("truetype");
          font-weight: 800;
          font-style: normal;
        }` : ""}
      `
      : `
        /* fallback if fonts missing */
        .t { font-family: Arial, sans-serif; }
      `;

    // ✅ Background:
    // 1) try user backgroundUrl
    // 2) fallback to /public/backgrounds/welcome.jpg
    const origin = url.origin;

    const [bgDataExternal, bgDataFallback, avatarData, iconData] = await Promise.all([
      fetchAsDataUri(backgroundImageUrl),
      localPublicImageDataUri(origin, "/backgrounds/welcome.jpg"),
      showAvatar ? fetchAsDataUri(avatarUrl) : Promise.resolve(null),
      fetchAsDataUri(serverIconUrl),
    ]);

    const bgData = bgDataExternal || bgDataFallback || null;

    const primaryLine = esc(title.replaceAll("{user.name}", username || "New member"));
    const secondaryLine = esc(
      subtitle
        .replaceAll("{membercount}", memberCount || "?")
        .replaceAll("{server.name}", serverName || "this server")
    );

    const svg = `
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            ${fontCss}
            .t { font-family: ${interRegular ? '"InterEmbed", Arial, sans-serif' : "Arial, sans-serif"}; }
          </style>

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

        <rect x="0" y="0" width="${W}" height="${H}" rx="30" fill="url(#base)"/>

        ${bgData ? `<image href="${bgData}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : ""}

        <rect x="0" y="0" width="${W}" height="${H}" rx="30" fill="rgba(0,0,0,${overlayOpacity})"/>

        <rect x="28" y="28" width="10" height="${H - 56}" rx="5" fill="#8b5cf6" opacity="0.95"/>

        <rect x="64" y="62" width="${W - 128}" height="${H - 124}" rx="26" fill="rgba(255,255,255,0.07)" filter="url(#softShadow)"/>

        ${
          avatarData
            ? `
              <circle cx="172" cy="210" r="96" fill="rgba(255,255,255,0.10)"/>
              <circle cx="172" cy="210" r="92" fill="rgba(0,0,0,0.20)"/>
              <image href="${avatarData}" x="86" y="124" width="172" height="172" clip-path="url(#avatarClip)"/>
            `
            : `<circle cx="172" cy="210" r="86" fill="rgba(255,255,255,0.12)"/>`
        }

        ${
          iconData
            ? `
              <circle cx="1088" cy="92" r="44" fill="rgba(255,255,255,0.10)"/>
              <image href="${iconData}" x="1050" y="54" width="76" height="76" clip-path="url(#iconClip)"/>
            `
            : ""
        }

        <text class="t" x="320" y="185" font-size="44" font-weight="800" fill="${textColor}">
          ${primaryLine}
        </text>

        <text class="t" x="320" y="232" font-size="22" font-weight="600" fill="${textColor}" opacity="0.88">
          ${secondaryLine}
        </text>

        <text class="t" x="${W - 84}" y="${H - 48}" text-anchor="end" font-size="16" fill="${textColor}" opacity="0.55">
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
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
