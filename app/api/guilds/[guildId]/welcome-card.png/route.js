import { ImageResponse } from "@vercel/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function isSnowflake(id) {
  const s = String(id || "").trim();
  return /^[0-9]{17,20}$/.test(s);
}

function pickFirst(...vals) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

function getGuildId(req, ctx) {
  const url = new URL(req.url);

  const fromParams = ctx?.params?.guildId;
  const fromQuery = url.searchParams.get("guildId");

  const m = url.pathname.match(/\/api\/guilds\/([^/]+)\/welcome-card\.png$/i);
  const fromPath = m?.[1];

  const gid = pickFirst(fromParams, fromPath, fromQuery);
  return isSnowflake(gid) ? gid : "";
}

function safeText(s, fallback) {
  const v = String(s ?? "").trim();
  return v || fallback;
}

export async function GET(req, ctx) {
  const url = new URL(req.url);
  const guildId = getGuildId(req, ctx);

  // Debug JSON
  if (url.searchParams.get("debug") === "1") {
    return new Response(
      JSON.stringify(
        {
          ok: true,
          route: "welcome-card.png",
          pathname: url.pathname,
          params: ctx?.params ?? null,
          guildIdResolved: guildId || null,
          query: Object.fromEntries(url.searchParams.entries()),
        },
        null,
        2
      ),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  if (!guildId) {
    return new Response(
      JSON.stringify(
        { error: "Missing guildId", hint: "Use /api/guilds/<guildId>/welcome-card.png" },
        null,
        2
      ),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  // Minimal inputs (no external images yet)
  const title = safeText(url.searchParams.get("title"), "HELLO");
  const subtitle = safeText(url.searchParams.get("subtitle"), "TEST");

  // IMPORTANT: absolute no external fetch, no <img>, no gradients-from-images.
  // This should render 100% if your OG pipeline is healthy.
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 400,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          backgroundColor: "#0b1020",
          color: "#ffffff",
          fontFamily: "system-ui, Segoe UI, Arial",
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>
          {title}
        </div>
        <div style={{ marginTop: 14, fontSize: 28, opacity: 0.9 }}>
          {subtitle}
        </div>
        <div style={{ marginTop: 22, fontSize: 16, opacity: 0.6 }}>
          guildId: {guildId}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
