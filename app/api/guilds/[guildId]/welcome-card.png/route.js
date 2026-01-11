import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// small helpers
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
  // 1) normal: App Router params
  const fromParams = ctx?.params?.guildId;

  // 2) fallback: query ?guildId=
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("guildId");

  // 3) fallback: parse from pathname /api/guilds/<id>/welcome-card.png
  // (works even if params is empty due to binding/rewrite weirdness)
  const m = url.pathname.match(/\/api\/guilds\/([^/]+)\/welcome-card\.png$/i);
  const fromPath = m?.[1];

  const gid = pickFirst(fromParams, fromPath, fromQuery);
  return isSnowflake(gid) ? gid : "";
}

function hexToRgba(hex, alpha = 0.35) {
  const h = String(hex || "").replace("#", "").trim();
  const ok = /^[0-9a-f]{6}$/i.test(h);
  const v = ok ? h : "0b1020";
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${r},${g},${b},${a})`;
}

export async function GET(req, ctx) {
  const url = new URL(req.url);
  const guildId = getGuildId(req, ctx);

  if (!guildId) {
    return Response.json(
      {
        error: "Missing guildId",
        hint:
          "Expected /api/guilds/<guildId>/welcome-card.png or ?guildId=<guildId>",
        got: {
          pathname: url.pathname,
          params: ctx?.params ?? null,
          queryGuildId: url.searchParams.get("guildId") || null,
        },
      },
      { status: 400 }
    );
  }

  // read inputs (your dashboard already sends these)
  const serverName = url.searchParams.get("serverName") || "Server";
  const username = url.searchParams.get("username") || "New Member";
  const tag = url.searchParams.get("tag") || "";
  const membercount = url.searchParams.get("membercount") || "";
  const title = url.searchParams.get("title") || `${username} just joined the server`;
  const subtitle = url.searchParams.get("subtitle") || (membercount ? `Member #${membercount}` : "");
  const backgroundUrl = url.searchParams.get("backgroundUrl") || "";
  const serverIconUrl = url.searchParams.get("serverIconUrl") || "";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const showAvatar = url.searchParams.get("showAvatar") === "true";

  const backgroundColor = url.searchParams.get("backgroundColor") || "#0b1020";
  const textColor = url.searchParams.get("textColor") || "#ffffff";
  const overlayOpacity = Number(url.searchParams.get("overlayOpacity") ?? 0.35);

  // cache-friendly headers (but still dynamic)
  const headers = {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
  };

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
          backgroundColor,
          color: textColor,
          fontFamily: "system-ui, Segoe UI, Inter, Arial",
          position: "relative",
        }}
      >
        {/* background image */}
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* overlay for readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hexToRgba(backgroundColor, overlayOpacity),
          }}
        />

        {/* left: server */}
        <div style={{ position: "relative", display: "flex", gap: 18, alignItems: "center" }}>
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
                background: "rgba(255,255,255,0.10)",
              }}
            />
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, opacity: 0.9 }}>{serverName}</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>
              {tag ? `${tag} • ` : ""}guildId: {guildId}
            </div>
          </div>
        </div>

        {/* middle text */}
        <div style={{ position: "relative", flex: 1, paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 22, marginTop: 10, opacity: 0.9 }}>{subtitle}</div>
          ) : null}
        </div>

        {/* right: avatar */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
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
                background: "rgba(255,255,255,0.10)",
              }}
            />
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 400, headers }
  );
}
