import { ImageResponse } from "next/og";

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

function safeHex(hex, fallback) {
  const s = String(hex || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  return fallback;
}

function clamp01(n, fallback = 0.35) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

export async function GET(req, ctx) {
  const url = new URL(req.url);

  const guildId = getGuildId(req, ctx);

  // 🔎 Debug mode: proves what Next is passing + what we parsed
  if (url.searchParams.get("debug") === "1") {
    return Response.json(
      {
        ok: true,
        route: "welcome-card.png",
        pathname: url.pathname,
        ctxKeys: Object.keys(ctx || {}),
        params: ctx?.params ?? null,
        guildIdResolved: guildId || null,
        query: Object.fromEntries(url.searchParams.entries()),
      },
      { status: 200 }
    );
  }

  if (!guildId) {
    return Response.json(
      {
        error: "Missing guildId",
        hint:
          "Use /api/guilds/<guildId>/welcome-card.png or ?guildId=<guildId>. Add ?debug=1 to inspect.",
        got: {
          pathname: url.pathname,
          params: ctx?.params ?? null,
          queryGuildId: url.searchParams.get("guildId") || null,
        },
      },
      { status: 400 }
    );
  }

  // Read inputs
  const serverName = url.searchParams.get("serverName") || "Server";
  const username = url.searchParams.get("username") || "New Member";
  const tag = url.searchParams.get("tag") || "";
  const membercount = url.searchParams.get("membercount") || "";

  const title =
    url.searchParams.get("title") || `${username} just joined the server`;
  const subtitle =
    url.searchParams.get("subtitle") ||
    (membercount ? `Member #${membercount}` : "");

  const backgroundUrl = url.searchParams.get("backgroundUrl") || "";
  const serverIconUrl = url.searchParams.get("serverIconUrl") || "";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const showAvatar = url.searchParams.get("showAvatar") === "true";

  // ✅ Force non-white defaults (even if params are missing)
  const backgroundColor = safeHex(
    url.searchParams.get("backgroundColor"),
    "#0b1020"
  );
  const textColor = safeHex(url.searchParams.get("textColor"), "#ffffff");
  const overlayOpacity = clamp01(
    url.searchParams.get("overlayOpacity"),
    0.35
  );

  const { r, g, b } = hexToRgb(backgroundColor);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 48,
          position: "relative",

          // If everything else fails, THIS still paints dark.
          backgroundColor,
          color: textColor,
          fontFamily: "system-ui, Segoe UI, Inter, Arial",
        }}
      >
        {/* Background image */}
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* Overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `rgba(${r},${g},${b},${overlayOpacity})`,
          }}
        />

        {/* Left: server */}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: 18,
            alignItems: "center",
            minWidth: 320,
          }}
        >
          {serverIconUrl ? (
            <img
              src={serverIconUrl}
              alt=""
              width={84}
              height={84}
              style={{ borderRadius: 24 }}
            />
          ) : (
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 24,
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            />
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, opacity: 0.92 }}>{serverName}</div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>
              {tag ? `${tag} • ` : ""}guildId: {guildId}
            </div>
          </div>
        </div>

        {/* Middle text */}
        <div style={{ position: "relative", flex: 1, padding: "0 32px" }}>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 22, marginTop: 10, opacity: 0.9 }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {/* Right: avatar */}
        <div
          style={{
            position: "relative",
            width: 160,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {showAvatar && avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={120}
              height={120}
              style={{
                borderRadius: 36,
                border: "3px solid rgba(255,255,255,0.25)",
              }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 36,
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            />
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 400,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    }
  );
}
