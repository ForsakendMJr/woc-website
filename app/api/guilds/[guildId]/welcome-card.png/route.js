import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

import dbConnect from "../../../../lib/mongodb";
import GuildSettings from "../../../../models/GuildSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ----------------------------- tiny utilities ----------------------------- */
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

function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  // WEBP ("RIFF"...."WEBP")
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";

  return null;
}

async function fetchAsDataUri(remoteUrl) {
  if (!remoteUrl) return null;

  try {
    const res = await fetch(remoteUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // Some CDNs behave differently if no Referer; harmless if ignored
        Referer: remoteUrl,
      },
    });

    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    // If server lies / omits content-type, sniff bytes
    const sniffed = sniffImageMime(buf);

    // Reject obvious HTML pages masquerading as images
    // (Freepik often sends HTML unless you’re “allowed”)
    const looksLikeHtml =
      ct.includes("text/html") ||
      (buf.slice(0, 40).toString("utf8").toLowerCase().includes("<!doctype html") ||
        buf.slice(0, 20).toString("utf8").toLowerCase().includes("<html"));

    if (looksLikeHtml) return null;

    const mime = ct.startsWith("image/") ? ct.split(";")[0] : sniffed;
    if (!mime) return null;

    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function localPublicAsDataUri(relPathFromPublic) {
  // supports "/welcome-bg.jpg" OR "welcome-bg.jpg"
  const rel = String(relPathFromPublic || "").replace(/^\/+/, "");
  if (!rel) return null;

  try {
    const abs = path.join(process.cwd(), "public", rel);
    const buf = await fs.readFile(abs);
    if (!buf.length) return null;

    const mime = sniffImageMime(buf) || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Auto-fit font size so title stays inside bubble
 * Rough math (fast + works well enough):
 * - average character width ~= fontSize * 0.60 (Inter-ish)
 */
function fitFontSize(text, maxWidthPx, baseSize, minSize) {
  const s = String(text || "");
  const len = Math.max(1, s.length);

  const avg = 0.60; // average glyph width factor
  const needed = maxWidthPx / (len * avg);

  const size = Math.floor(Math.min(baseSize, needed));
  return clamp(size, minSize, baseSize);
}

export async function GET(req, { params }) {
  try {
    const url = new URL(req.url);
    const guildId = params?.guildId;

    /* ----------------------- optional defaults from DB ---------------------- */
    let dbDefaults = {};
    try {
      if (guildId) {
        await dbConnect();
        const settings = await GuildSettings.findOne({ guildId }).lean();
        const wc = settings?.welcomeCard || settings?.modules?.welcomeCard || null;

        if (wc && typeof wc === "object") {
          dbDefaults = {
            backgroundUrl: wc.backgroundUrl || wc.backgroundImageUrl || "",
            backgroundColor: wc.backgroundColor || "",
            textColor: wc.textColor || "",
            overlayOpacity:
              typeof wc.overlayOpacity === "number" ? String(wc.overlayOpacity) : "",
            title: wc.title || "",
            subtitle: wc.subtitle || "",
            showAvatar: typeof wc.showAvatar === "boolean" ? String(wc.showAvatar) : "",
          };
        }
      }
    } catch (e) {
      console.warn("[welcome-card] settings lookup failed:", e?.message || e);
    }

    /* ---------------- query params (query > db > defaults) ---------------- */
    const backgroundUrlRaw =
      qp(url, "backgroundUrl", "") ||
      qp(url, "backgroundImageUrl", "") ||
      qp(url, "background", "") ||
      dbDefaults.backgroundUrl ||
      "";

    const titleRaw = qp(url, "title", dbDefaults.title || "Welcome!");
    const subtitleRaw = qp(url, "subtitle", dbDefaults.subtitle || "");

    const bgColor = qp(url, "backgroundColor", dbDefaults.backgroundColor || "#0b1020");
    const textColor = qp(url, "textColor", dbDefaults.textColor || "#ffffff");
    const overlayOpacity = clamp(qp(url, "overlayOpacity", dbDefaults.overlayOpacity || "0.35"), 0, 0.85);

    const showAvatar = qp(url, "showAvatar", dbDefaults.showAvatar || "true") !== "false";

    const username = truncate(qp(url, "username", ""), 36);
    const serverName = truncate(qp(url, "serverName", ""), 40);
    const memberCount = qp(url, "membercount", qp(url, "memberCount", ""));

    const avatarUrl = qp(url, "avatarUrl", "");
    const serverIconUrl = qp(url, "serverIconUrl", "");

    // --- Canvas size ---
    const W = 1200;
    const H = 420;

    // Text rendering replacements
    const primaryLineText = truncate(
      titleRaw.replaceAll("{user.name}", username || "New member"),
      90
    );
    const secondaryLineText = truncate(
      subtitleRaw
        .replaceAll("{membercount}", memberCount || "?")
        .replaceAll("{server.name}", serverName || "this server"),
      90
    );

    // Bubble geometry (your text starts at x=320; keep safe right padding)
    const textX = 320;
    const rightSafe = 110; // space away from edge / server icon area
    const maxTextWidth = W - textX - rightSafe;

    // ✅ Auto-fit title size
    const titleSize = fitFontSize(primaryLineText, maxTextWidth, 44, 22);

    // Subtitle can also be fitted lightly (optional)
    const subtitleSize = fitFontSize(secondaryLineText, maxTextWidth, 22, 16);

    // ✅ Background: support local files (/welcome-bg.jpg) + remote URLs
    let bgData = null;
    if (backgroundUrlRaw.startsWith("/")) {
      bgData = await localPublicAsDataUri(backgroundUrlRaw);
    } else {
      bgData = await fetchAsDataUri(backgroundUrlRaw);
    }

    const [avatarData, iconData] = await Promise.all([
      showAvatar ? fetchAsDataUri(avatarUrl) : Promise.resolve(null),
      fetchAsDataUri(serverIconUrl),
    ]);

    const primaryLine = esc(primaryLineText);
    const secondaryLine = esc(secondaryLineText);

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

  <!-- ✅ Use system font fallback; Resvg handles this better than SVG embedded fonts -->
  <text x="${textX}" y="185" font-size="${titleSize}" font-weight="800"
    font-family="DejaVu Sans, Arial, sans-serif"
    fill="${textColor}">
    ${primaryLine}
  </text>

  <text x="${textX}" y="232" font-size="${subtitleSize}" font-weight="600"
    font-family="DejaVu Sans, Arial, sans-serif"
    fill="${textColor}" opacity="0.88">
    ${secondaryLine}
  </text>

  <text x="${W - 84}" y="${H - 48}" text-anchor="end" font-size="16"
    font-family="DejaVu Sans, Arial, sans-serif"
    fill="${textColor}" opacity="0.55">
    WoC • Welcome Card
  </text>

</svg>
`;

    // Render with sharp (SVG -> PNG)
    const png = await sharp(Buffer.from(svg), { density: 144 })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return new NextResponse(png, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[welcome-card] render error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
