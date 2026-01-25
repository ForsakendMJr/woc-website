// app/api/guilds/[guildId]/welcome-card.png/route.js
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";

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

/* --------------------------- image / bg helpers --------------------------- */
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

function looksLikeHtmlResponse(contentType, buf) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("text/html")) return true;

  const head = buf.slice(0, 200).toString("utf8").toLowerCase();
  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<head") ||
    head.includes("<script")
  );
}

async function fetchAsDataUriWithStatus(remoteUrl) {
  // returns: { dataUri, status }
  // status: "none" | "ok" | "blocked_html" | "fetch_failed"
  if (!remoteUrl) return { dataUri: null, status: "none" };

  try {
    const res = await fetch(remoteUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: remoteUrl,
      },
    });

    if (!res.ok) return { dataUri: null, status: "fetch_failed" };

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { dataUri: null, status: "fetch_failed" };

    const ct = res.headers.get("content-type") || "";

    // 🔥 Freepik-style “here’s HTML, good luck” detection
    if (looksLikeHtmlResponse(ct, buf)) {
      return { dataUri: null, status: "blocked_html" };
    }

    const declared = (ct || "").toLowerCase();
    const mime = declared.startsWith("image/") ? declared.split(";")[0] : sniffImageMime(buf);
    if (!mime) return { dataUri: null, status: "fetch_failed" };

    return { dataUri: `data:${mime};base64,${buf.toString("base64")}`, status: "ok" };
  } catch {
    return { dataUri: null, status: "fetch_failed" };
  }
}

async function localPublicAsDataUri(relPathFromPublic) {
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
 * Auto-fit font size so title stays inside the bubble.
 * average glyph width ~= fontSize * 0.60 (Inter-ish)
 */
function fitFontSize(text, maxWidthPx, baseSize, minSize) {
  const s = String(text || "");
  const len = Math.max(1, s.length);
  const avg = 0.60;
  const needed = maxWidthPx / (len * avg);
  const size = Math.floor(Math.min(baseSize, needed));
  return clamp(size, minSize, baseSize);
}

export async function GET(req, { params }) {
  try {
    const url = new URL(req.url);
    const guildId = params?.guildId;
    const metaMode = qp(url, "meta", "0") === "1";

    // ✅ runtime require (avoids Turbopack bundling explosions)
    const require = createRequire(import.meta.url);
    const { Resvg } = require("@resvg/resvg-js");

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
            overlayOpacity: typeof wc.overlayOpacity === "number" ? String(wc.overlayOpacity) : "",
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

    const W = 1200;
    const H = 420;

    // Token replacements (allow longer text, we will shrink)
    const primaryLineText = truncate(
      titleRaw.replaceAll("{user.name}", username || "New member"),
      140
    );
    const secondaryLineText = truncate(
      subtitleRaw
        .replaceAll("{membercount}", memberCount || "?")
        .replaceAll("{server.name}", serverName || "this server"),
      140
    );

    // Bubble geometry: text starts at x=320; reserve safe padding on the right
    const textX = 320;
    const rightSafe = 120;
    const maxTextWidth = W - textX - rightSafe;

    // ✅ auto-fit title + subtitle sizes
    const titleSize = fitFontSize(primaryLineText, maxTextWidth, 44, 22);
    const subtitleSize = fitFontSize(secondaryLineText, maxTextWidth, 22, 16);

    // ✅ background: support local "/file.jpg" OR remote URL
    let bgData = null;
    let bgStatus = "none";

    if (backgroundUrlRaw) {
      if (backgroundUrlRaw.startsWith("/")) {
        bgData = await localPublicAsDataUri(backgroundUrlRaw);
        bgStatus = bgData ? "ok" : "fetch_failed";
      } else {
        const bgRes = await fetchAsDataUriWithStatus(backgroundUrlRaw);
        bgData = bgRes.dataUri;
        bgStatus = bgRes.status;
      }
    }

    // Optional: return background status as JSON for your UI to display a warning
    if (metaMode) {
      return NextResponse.json({
        ok: true,
        background: {
          input: backgroundUrlRaw || "",
          status: bgStatus, // ok | blocked_html | fetch_failed | none
        },
      });
    }

    const [avatarRes, iconRes] = await Promise.all([
      showAvatar ? fetchAsDataUriWithStatus(avatarUrl) : Promise.resolve({ dataUri: null, status: "none" }),
      fetchAsDataUriWithStatus(serverIconUrl),
    ]);
    const avatarData = avatarRes.dataUri;
    const iconData = iconRes.dataUri;

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

    <clipPath id="avatarClip"><circle cx="172" cy="210" r="86"/></clipPath>
    <clipPath id="iconClip"><circle cx="1088" cy="92" r="38"/></clipPath>
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

  <text x="${textX}" y="185" font-size="${titleSize}" font-weight="800" fill="${textColor}"
    font-family="Inter">
    ${primaryLine}
  </text>

  <text x="${textX}" y="232" font-size="${subtitleSize}" font-weight="600" fill="${textColor}" opacity="0.88"
    font-family="Inter">
    ${secondaryLine}
  </text>

  <text x="${W - 84}" y="${H - 48}" text-anchor="end" font-size="16" font-weight="500"
    fill="${textColor}" opacity="0.55" font-family="Inter">
    WoC • Welcome Card
  </text>
</svg>`.trim();

    // ✅ Resvg: load your font files (THIS is why the “old code” had real text)
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: W },
      font: {
        fontFiles: [
          path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf"),
          path.join(process.cwd(), "public", "fonts", "Inter-ExtraBold.ttf"),
        ],
        defaultFontFamily: "Inter",
        loadSystemFonts: false,
      },
    });

    const png = resvg.render().asPng();

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        // ✅ UI can read this (and show warning text)
        "X-WoC-Background-Status": bgStatus, // ok | blocked_html | fetch_failed | none
      },
    });
  } catch (err) {
    console.error("[welcome-card] render error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
