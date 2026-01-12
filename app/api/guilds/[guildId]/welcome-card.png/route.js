import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";
// ImageResponse is happiest on edge (and avoids Node canvas issues)
export const runtime = "edge";

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

  // Next sometimes fails to populate ctx.params on some deployments,
  // so we parse it from the pathname too.
  const fromParams = ctx?.params?.guildId;
  const fromQuery = url.searchParams.get("guildId");

  // Works for /api/guilds/<id>/welcome-card.png
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

// Simple token replace for preview convenience
function applyTokens(str, vars) {
  return String(str || "").replace(/\{([^}]+)\}/g, (_, key) => {
    const k = String(key || "").trim();
    return vars[k] != null ? String(vars[k]) : `{${k}}`;
  });
}

// ✅ Always return a PNG (even error states) unless debug=1
function errorPng(message = "Bad request") {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          background: "#0b1020",
          color: "#ffffff",
          fontFamily: "system-ui, Segoe UI, Inter, Arial",
        }}
      >
        <div
          style={{
            width: "100%",
            borderRadius: 24,
            padding: 32,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800 }}>Welcome card preview</div>
          <div style={{ marginTop: 12, fontSize: 18, opacity: 0.9 }}>{message}</div>
          <div style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>
            Tip: open the endpoint directly with a real guildId.
          </div>
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

export async function GET(req, ctx) {
  const url = new URL(req.url);
  const guildId = getGuildId(req, ctx);

  // 🔎 Debug mode returns JSON on purpose
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

  // If missing guildId, return PNG (so <img> doesn’t break into HTML/JSON confusion)
  if (!guildId) {
    const qGid = url.searchParams.get("guildId");
    const hint =
      qGid && !isSnowflake(qGid)
        ? `Invalid guildId: "${qGid}". Replace <gid> with your real numeric guild id.`
        : "Missing guildId. Use /api/guilds/<guildId>/welcome-card.png";
    return errorPng(hint);
  }

  // Inputs
  const serverName = url.searchParams.get("serverName") || "Server";
  const username = url.searchParams.get("username") || "New Member";
  const tag = url.searchParams.get("tag") || "";
  const membercount = url.searchParams.get("membercount") || "";

  const rawTitle = url.searchParams.get("title") || "{user.name} just joined the server";
  const rawSubtitle = url.searchParams.get("subtitle") || "Member #{membercount}";

  const backgroundUrl = url.searchParams.get("backgroundUrl") || "";
  const serverIconUrl = url.searchParams.get("serverIconUrl") || "";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const showAvatar = url.searchParams.get("showAvatar") === "true";

  // Non-white defaults
  const backgroundColor = safeHex(url.searchParams.get("backgroundColor"), "#0b1020");
  const textColor = safeHex(url.searchParams.get("textColor"), "#ffffff");
  const overlayOpacity = clamp01(url.searchParams.get("overlayOpacity"), 0.35);

  const { r, g, b } = hexToRgb(backgroundColor);

  const tokens = {
    "server": serverName,
    "server.name": serverName,
    "user": username,
    "user.name": username,
    "username": username,
    "tag": tag,
    "membercount": membercount,
    "server.member_count": membercount,
    "id": guildId,
  };

  const title = applyTokens(rawTitle, tokens);
  const subtitle = applyTokens(rawSubtitle, tokens);

  // In some cases external images fail to load in OG rendering.
  // We still guarantee a dark background + overlay so it never becomes a white blank.
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
          backgroundColor,
          color: textColor,
          fontFamily: "system-ui, Segoe UI, Inter, Arial",
        }}
      >
        {/* Background image (optional) */}
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

        {/* Overlay always paints */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(${r},${g},${b},${overlayOpacity})`,
          }}
        />

        {/* Left */}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: 18,
            alignItems: "center",
            minWidth: 340,
          }}
        >
          {serverIconUrl ? (
            <img src={serverIconUrl} alt="" width={84} height={84} style={{ borderRadius: 24 }} />
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

        {/* Middle */}
        <div style={{ position: "relative", flex: 1, padding: "0 32px" }}>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 22, marginTop: 10, opacity: 0.9 }}>{subtitle}</div>
          ) : null}
        </div>

        {/* Right */}
        <div style={{ position: "relative", width: 160, display: "flex", justifyContent: "flex-end" }}>
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
