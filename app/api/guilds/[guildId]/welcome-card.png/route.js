// src/app/api/guilds/[guildId]/welcome-card.png/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";          // IMPORTANT (canvas/sharp need Node)
export const dynamic = "force-dynamic";   // avoid caching weirdness while debugging

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

// TODO: Replace this with your real renderer
async function renderWelcomeCardPng(params) {
  // MUST return a Buffer (or Uint8Array) with PNG bytes
  // For now, generate a tiny 1x1 PNG so you can confirm bytes flow.
  const png1x1 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7x0n8AAAAASUVORK5CYII=";
  return Buffer.from(png1x1, "base64");
}

export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);

    const payload = {
      guildId: params.guildId,
      serverName: str(searchParams.get("serverName"), "Server"),
      memberName: str(searchParams.get("memberName"), "Member"),
      memberCount: num(searchParams.get("memberCount"), 1),
      avatarUrl: str(searchParams.get("avatarUrl"), ""),
      serverIconUrl: str(searchParams.get("serverIconUrl"), ""),
      subtitle: str(searchParams.get("subtitle"), ""),
      backgroundColor: str(searchParams.get("backgroundColor"), "#0b1020"),
      textColor: str(searchParams.get("textColor"), "#ffffff"),
    };

    const pngBuffer = await renderWelcomeCardPng(payload);

    // 🔥 This is the key sanity check. If this logs 0, your renderer produced nothing.
    if (!pngBuffer || pngBuffer.length === 0) {
      console.error("[welcome-card] PNG buffer is empty", { guildId: payload.guildId });
      return NextResponse.json(
        { ok: false, error: "Renderer returned empty PNG buffer" },
        { status: 500 }
      );
    }

    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(pngBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[welcome-card] route error:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
