import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";
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
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const h = s.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
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
        {
          error: "Missing guildId",
          hint: "Use /api/guilds/<guildId>/welcome-card.png or ?guildId=<guildId>.",
          got: {
            pathname: url.pathname,
            params: ctx?.params ?? null,
            queryGuildId: url.searchParams.get("guildId") || null,
          },
        },
        null,
        2
      ),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  // Inputs
  const serverName = url.searchParams.get("serverName") || "Server";
  const username = url.searchParams.get("username") || "New Member";
  const membercount = url.searchParams.get("membercount") || "";
  const title = url.searchParams.get("title") || `${username} just joined the server`;
  const subtitle =
    url.searchParams.get("subtitle") || (membercount ? `Member #${membercount}` : "");

  const backgroundUrl = url.searchParams.get("backgroundUrl") || "";
  const serverIconUrl = url.searchParams.get("serverIconUrl") || "";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const showAvatar = url.searchParams.get("showAvatar") === "true";

  const backgroundColor = safeHex(url.searchParams.get("backgroundColor"), "#0b1020");
  const textColor = safeHex(url.searchParams.get("textColor"), "#ffffff");
  const overlayOpacity = clamp01(url.searchParams.get("overlayOpacity"), 0.35);

  const { r, g, b } = hexToRgb(backgroundColor);

  // ✅ plain=1 disables ALL external images to prove rendering works
  const plain = url.searchParams.get("plain") === "1";

  try {
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
            overflow: "hidden",
            color: textColor,
            fontFamily: "system-ui, Segoe UI, Inter, Arial",

            // Strongly non-white base + a subtle gradient layer
            backgroundColor,
            backgroundImage:
              "radial-gradient(900px 350px at 20% 20%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(700px 320px at 80% 30%, rgba(16,185,129,0.22), transparent 55%)",
          }}
        >
          {/* Background image */}
          {!plain && backgroundUrl ? (
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

          {/* Overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: `rgba(${r},${g},${b},${overlayOpacity})`,
            }}
          />

          {/* Left */}
          <div style={{ position: "relative", display: "flex", gap: 18, alignItems: "center" }}>
            {!plain && serverIconUrl ? (
              <img
                src={serverIconUrl}
                alt=""
                width={84}
                height={84}
                style={{
                  borderRadius: 26,
                  border: "2px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 26,
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              />
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, opacity: 0.92 }}>{serverName}</div>
              <div style={{ fontSize: 14, opacity: 0.75 }}>guildId: {guildId}</div>
              {plain ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>(plain mode)</div>
              ) : null}
            </div>
          </div>

          {/* Middle */}
          <div style={{ position: "relative", flex: 1, padding: "0 32px" }}>
            <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1.05, letterSpacing: -0.6 }}>
              {title}
            </div>
            {subtitle ? (
              <div style={{ fontSize: 22, marginTop: 12, opacity: 0.9 }}>{subtitle}</div>
            ) : null}
          </div>

          {/* Right */}
          <div style={{ position: "relative", width: 160, display: "flex", justifyContent: "flex-end" }}>
            {!plain && showAvatar && avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                width={120}
                height={120}
                style={{
                  borderRadius: 40,
                  border: "3px solid rgba(255,255,255,0.25)",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 40,
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              />
            )}
          </div>
        </div>
      ),
      { width: 1200, height: 400 }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Image render failed", message: String(e?.message || e) }, null, 2),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
