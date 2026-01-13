import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || "").trim());
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
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

function clamp01(n, fallback = 0.35) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : fallback;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export async function GET(req, ctx) {
  const url = new URL(req.url);
  const guildId = getGuildId(req, ctx);

  if (url.searchParams.get("debug") === "1") {
    return Response.json({
      ok: true,
      route: "welcome-card.png",
      pathname: url.pathname,
      params: ctx?.params ?? null,
      guildIdResolved: guildId || null,
      query: Object.fromEntries(url.searchParams.entries()),
    });
  }

  if (!guildId) {
    return new Response("Missing guildId", { status: 400 });
  }

  const serverName = url.searchParams.get("serverName") || "Server";
  const username = url.searchParams.get("username") || "New Member";
  const membercount = url.searchParams.get("membercount") || "";

  const title =
    url.searchParams.get("title") ||
    `${username} just joined the server`;

  const subtitle =
    url.searchParams.get("subtitle") ||
    (membercount ? `Member #${membercount}` : "");

  const backgroundUrl = url.searchParams.get("backgroundUrl") || "";
  const serverIconUrl = url.searchParams.get("serverIconUrl") || "";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const showAvatar = url.searchParams.get("showAvatar") === "true";

  const backgroundColor = safeHex(
    url.searchParams.get("backgroundColor"),
    "#0b1020"
  );
  const textColor = safeHex(
    url.searchParams.get("textColor"),
    "#ffffff"
  );
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
          padding: 48,
          backgroundColor,
          color: textColor,
          position: "relative",
          fontFamily: "Inter, system-ui",
        }}
      >
        {backgroundUrl && (
          <img
            src={backgroundUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(${r},${g},${b},${overlayOpacity})`,
          }}
        />

        <div style={{ position: "relative", display: "flex", gap: 20 }}>
          {serverIconUrl && (
            <img
              src={serverIconUrl}
              width={80}
              height={80}
              style={{ borderRadius: 20 }}
            />
          )}
          <div>
            <div style={{ fontSize: 22 }}>{serverName}</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>
              guildId: {guildId}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "0 40px", position: "relative" }}>
          <div style={{ fontSize: 44, fontWeight: 800 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 22, opacity: 0.9 }}>{subtitle}</div>
          )}
        </div>

        {showAvatar && avatarUrl && (
          <img
            src={avatarUrl}
            width={120}
            height={120}
            style={{
              borderRadius: 36,
              border: "3px solid rgba(255,255,255,0.25)",
              position: "relative",
            }}
          />
        )}
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
