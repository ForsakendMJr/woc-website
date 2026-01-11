// app/api/guilds/[guildId]/welcome-card.png/route.js

import { NextResponse } from "next/server";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export const runtime = "nodejs"; // IMPORTANT: canvas needs Node runtime (not Edge)
export const dynamic = "force-dynamic"; // avoid caching surprises while testing

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function asStr(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function asBool(v, fallback = false) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeColor(hex, fallback) {
  const s = String(hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{3}$/.test(s)) return s;
  return fallback;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function tryLoadImage(url, timeoutMs = 4500) {
  if (!url) return null;
  // Basic “looks like image” guard: still allow querystrings etc.
  const u = String(url);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // @napi-rs/canvas loadImage can accept URL, but if the host blocks,
    // it will throw. We catch and return null.
    const img = await loadImage(u, { signal: controller.signal });
    return img;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function drawCover(ctx, img, x, y, w, h) {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;

  const scale = Math.max(w / iw, h / ih);
  const sw = iw * scale;
  const sh = ih * scale;
  const sx = x + (w - sw) / 2;
  const sy = y + (h - sh) / 2;

  ctx.drawImage(img, sx, sy, sw, sh);
}

export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);

    const guildId = asStr(params?.guildId, "");
    if (!guildId) {
      return NextResponse.json({ error: "Missing guildId." }, { status: 400 });
    }

    // Query params your dashboard builds:
    const serverName = asStr(searchParams.get("serverName"), "Server");
    const username = asStr(searchParams.get("username"), "New Member");
    const tag = asStr(searchParams.get("tag"), "");
    const membercount = asStr(searchParams.get("membercount"), "");
    const title = asStr(searchParams.get("title"), `${username} just joined`);
    const subtitle = asStr(
      searchParams.get("subtitle"),
      membercount ? `Member #${membercount}` : "Welcome!"
    );

    const serverIconUrl = asStr(searchParams.get("serverIconUrl"), "");
    const avatarUrl = asStr(searchParams.get("avatarUrl"), "");
    const backgroundUrl = asStr(searchParams.get("backgroundUrl"), "");

    const backgroundColor = safeColor(searchParams.get("backgroundColor"), "#0b1020");
    const textColor = safeColor(searchParams.get("textColor"), "#ffffff");
    const overlayOpacity = clamp(asNum(searchParams.get("overlayOpacity"), 0.35), 0, 1);
    const showAvatar = asBool(searchParams.get("showAvatar"), true);

    // Canvas size (looks good in Discord, and in your dashboard preview)
    const W = 1024;
    const H = 360;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // --- Base: never-white stylish background ---
    // 1) gradient base
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0b1020");
    grad.addColorStop(0.55, "#070a12");
    grad.addColorStop(1, "#120818");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2) subtle noise-ish dots (cheap, but effective)
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Card frame ---
    const pad = 22;
    const cardX = pad;
    const cardY = pad;
    const cardW = W - pad * 2;
    const cardH = H - pad * 2;
    const radius = 26;

    // card background clip
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, radius);
    ctx.clip();

    // Fill fallback background color (so if bg image fails, it still looks good)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Background image (cover)
    const bgImg = await tryLoadImage(backgroundUrl);
    if (bgImg) {
      drawCover(ctx, bgImg, cardX, cardY, cardW, cardH);
    }

    // Overlay for readability
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Neon accent slashes (unique “WoC” vibe)
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(124,58,237,0.55)";
    ctx.beginPath();
    ctx.moveTo(cardX + cardW * 0.62, cardY - 20);
    ctx.lineTo(cardX + cardW * 0.92, cardY + cardH + 20);
    ctx.stroke();

    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(244,63,94,0.35)";
    ctx.beginPath();
    ctx.moveTo(cardX + cardW * 0.55, cardY - 20);
    ctx.lineTo(cardX + cardW * 0.85, cardY + cardH + 20);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Top glow bar
    const topGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
    topGrad.addColorStop(0, "rgba(124,58,237,0.55)");
    topGrad.addColorStop(0.5, "rgba(59,130,246,0.25)");
    topGrad.addColorStop(1, "rgba(244,63,94,0.45)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(cardX, cardY, cardW, 8);

    ctx.restore();

    // Frame border
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, radius);
    ctx.stroke();

    // --- Icons (server + avatar) ---
    const left = cardX + 28;
    const top = cardY + 26;

    // Server icon (circle)
    const serverSize = 62;
    const serverImg = await tryLoadImage(serverIconUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(left + serverSize / 2, top + serverSize / 2, serverSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (serverImg) {
      ctx.drawImage(serverImg, left, top, serverSize, serverSize);
    } else {
      // fallback: gradient disc
      const g2 = ctx.createLinearGradient(left, top, left + serverSize, top + serverSize);
      g2.addColorStop(0, "rgba(124,58,237,0.9)");
      g2.addColorStop(1, "rgba(244,63,94,0.75)");
      ctx.fillStyle = g2;
      ctx.fillRect(left, top, serverSize, serverSize);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "700 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(serverName.slice(0, 1).toUpperCase(), left + serverSize / 2, top + serverSize / 2);
    }
    ctx.restore();

    // Avatar (right side)
    const avatarSize = 104;
    const avatarX = cardX + cardW - avatarSize - 34;
    const avatarY = cardY + (cardH - avatarSize) / 2;

    if (showAvatar) {
      const avImg = await tryLoadImage(avatarUrl);
      // ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
      ctx.closePath();
      const ringGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
      ringGrad.addColorStop(0, "rgba(124,58,237,0.9)");
      ringGrad.addColorStop(1, "rgba(244,63,94,0.8)");
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      // avatar circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (avImg) {
        ctx.drawImage(avImg, avatarX, avatarY, avatarSize, avatarSize);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      }
      ctx.restore();
    }

    // --- Text ---
    const textLeft = left + serverSize + 18;
    const textMaxW = (showAvatar ? avatarX : cardX + cardW) - textLeft - 28;

    // Server name + tag row
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "600 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(serverName, textLeft, top + 4);

    if (tag) {
      const tagText = tag.startsWith("@") ? tag : `@${tag}`;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillText(tagText, textLeft, top + 26);
    }

    // Big title
    ctx.fillStyle = textColor;
    ctx.font = "800 40px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    // soft shadow
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;

    // Basic truncate to fit width
    let t = title;
    while (ctx.measureText(t).width > textMaxW && t.length > 6) t = t.slice(0, -2);
    if (t !== title) t = t.slice(0, -1) + "…";

    ctx.fillText(t, textLeft, top + 70);

    // Subtitle
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";

    let st = subtitle;
    while (ctx.measureText(st).width > textMaxW && st.length > 6) st = st.slice(0, -2);
    if (st !== subtitle) st = st.slice(0, -1) + "…";

    ctx.fillText(st, textLeft, top + 126);

    // Footer “signature”
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("World of Communities • Welcome System", textLeft, cardY + cardH - 34);

    const png = canvas.toBuffer("image/png");

    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    // If something *still* explodes, return a readable JSON error so you can see it in the browser.
    return NextResponse.json(
      {
        error: "welcome-card route failed",
        message: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}
