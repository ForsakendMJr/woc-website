// app/api/guilds/[guildId]/welcome-card.png/route.js
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";

import dbConnect from "../../../../lib/mongodb";
import GuildSettings from "../../../../models/GuildSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
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

async function readPublicFileAsDataUri(relPathFromPublic) {
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

// ✅ Try common extensions for ID-like values (e.g. "rough_paper")
async function tryResolveWelcomeBackground(value) {
  const raw = String(value || "").trim();
  if (!raw) return { kind: "none", resolved: "", dataUri: null, status: "none" };

  // Normalize Windows backslashes just in case someone pasted them
  const s = raw.replaceAll("\\", "/");

  // Already a local public path?
  if (s.startsWith("/")) {
    const dataUri = await readPublicFileAsDataUri(s);
    return {
      kind: "local",
      resolved: s,
      dataUri,
      status: dataUri ? "ok" : "fetch_failed",
    };
  }

  // Looks like a URL?
  if (/^https?:\/\//i.test(s)) {
    return { kind: "remote", resolved: s, dataUri: null, status: "unknown" };
  }

  // Missing leading slash but contains a folder (e.g. "welcome-backgrounds/x.png")
  if (s.includes("/")) {
    const asLocal = `/${s.replace(/^\/+/, "")}`;
    const dataUri = await readPublicFileAsDataUri(asLocal);
    return {
      kind: "local",
      resolved: asLocal,
      dataUri,
      status: dataUri ? "ok" : "fetch_failed",
    };
  }

  // Filename with extension? assume /welcome-backgrounds/
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(s)) {
    const asLocal = `/welcome-backgrounds/${s}`;
    const dataUri = await readPublicFileAsDataUri(asLocal);
    return {
      kind: "local",
      resolved: asLocal,
      dataUri,
      status: dataUri ? "ok" : "fetch_failed",
    };
  }

  // ID-like value: try common extensions in /welcome-backgrounds/
  const base = s;
  const candidates = [
    `/welcome-backgrounds/${base}.png`,
    `/welcome-backgrounds/${base}.webp`,
    `/welcome-backgrounds/${base}.jpg`,
    `/welcome-backgrounds/${base}.jpeg`,
    `/welcome-backgrounds/${base}.gif`,
  ];

  for (const p of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const dataUri = await readPublicFileAsDataUri(p);
    if (dataUri) {
      return { kind: "local", resolved: p, dataUri, status: "ok" };
    }
  }

  return { kind: "local", resolved: `/welcome-backgrounds/${base}.*`, dataUri: null, status: "fetch_failed" };
}

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

    const require = createRequire(import.meta.url);
    const { Resvg } = require("@resvg/resvg-js");

    let dbDefaults = {};
    try {
      if (guildId) {
        await dbConnect();
        const settings = await GuildSettings.findOne({ guildId }).lean();

        // ✅ Your dashboard stores welcome under settings.welcome.card.*
        // But we also support older shapes so nothing breaks.
        const wc =
          settings?.welcome?.card ||
          settings?.welcomeCard ||
          settings?.modules?.welcomeCard ||
          null;

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

    const backgroundUrlRaw =
      qp(url, "backgroundUrl", "") ||
      qp(url, "backgroundImageUrl", "") ||
      qp(url, "background", "") ||
      dbDefaults.backgroundUrl ||
      "";

    // ✅ Robust background resolution
    let bgData = null;
    let bgStatus = "none";
    let bgKind = "none";
    let bgResolved = "";

    if (backgroundUrlRaw) {
      // If it's a URL and same-origin, treat as local public file (more reliable than fetching yourself)
      if (/^https?:\/\//i.test(backgroundUrlRaw)) {
        try {
          const reqHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
          const reqProto = req.headers.get("x-forwarded-proto") || "https";
          const origin = reqHost ? `${reqProto}://${reqHost}` : url.origin;

          const parsed = new URL(backgroundUrlRaw);
          const isSameOrigin = parsed.origin === origin;

          if (isSameOrigin) {
            const localPath = parsed.pathname || "";
            const dataUri = await readPublicFileAsDataUri(localPath);
            bgKind = "local";
            bgResolved = localPath;
            bgData = dataUri;
            bgStatus = dataUri ? "ok" : "fetch_failed";
          } else {
            const bgRes = await fetchAsDataUriWithStatus(backgroundUrlRaw);
            bgKind = "remote";
            bgResolved = backgroundUrlRaw;
            bgData = bgRes.dataUri;
            bgStatus = bgRes.status;
          }
        } catch {
          const bgRes = await fetchAsDataUriWithStatus(backgroundUrlRaw);
          bgKind = "remote";
          bgResolved = backgroundUrlRaw;
          bgData = bgRes.dataUri;
          bgStatus = bgRes.status;
        }
      } else {
        // Not a URL: resolve it as a local welcome background (supports ids / filenames / missing slashes)
        const resolved = await tryResolveWelcomeBackground(backgroundUrlRaw);
        bgKind = resolved.kind;
        bgResolved = resolved.resolved;
        bgData = resolved.dataUri;
        bgStatus = resolved.status;

        // If it wasn't resolvable locally but actually looks like a remote URL without protocol (rare), you can add logic here.
      }
    }

    if (metaMode) {
      return NextResponse.json({
        ok: true,
        background: {
          input: backgroundUrlRaw || "",
          kind: bgKind,          // local | remote | none
          resolved: bgResolved,  // resolved local path or URL
          status: bgStatus,      // ok | blocked_html | fetch_failed | none
        },
      });
    }

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

    const textX = 320;
    const rightSafe = 120;
    const maxTextWidth = W - textX - rightSafe;

    const titleSize = fitFontSize(primaryLineText, maxTextWidth, 44, 22);
    const subtitleSize = fitFontSize(secondaryLineText, maxTextWidth, 22, 16);

    const [avatarRes, iconRes] = await Promise.all([
      showAvatar
        ? fetchAsDataUriWithStatus(avatarUrl)
        : Promise.resolve({ dataUri: null, status: "none" }),
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

  <text x="${textX}" y="185" font-size="${titleSize}" font-weight="800" fill="${textColor}" font-family="Inter">
    ${primaryLine}
  </text>

  <text x="${textX}" y="232" font-size="${subtitleSize}" font-weight="600" fill="${textColor}" opacity="0.88" font-family="Inter">
    ${secondaryLine}
  </text>

  <text x="${W - 84}" y="${H - 48}" text-anchor="end" font-size="16" font-weight="500"
    fill="${textColor}" opacity="0.55" font-family="Inter">
    WoC • Welcome Card
  </text>
</svg>`.trim();

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
        "X-WoC-Background-Status": bgStatus,
        "X-WoC-Background-Kind": bgKind,
        "X-WoC-Background-Resolved": encodeURIComponent(bgResolved || ""),
      },
    });
  } catch (err) {
    console.error("[welcome-card] render error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
