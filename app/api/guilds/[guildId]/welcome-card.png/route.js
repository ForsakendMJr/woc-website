import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // keep nodejs so Buffer/base64 is easy & reliable

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

  // Safety: sometimes params can be empty; parse from pathname too
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

async function fetchImageAsDataUrl(inputUrl, { timeoutMs = 2500, maxBytes = 2_500_000 } = {}) {
  const u = String(inputUrl || "").trim();
  if (!u) return "";

  // Only allow http(s)
  if (!/^https?:\/\//i.test(u)) return "";

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(u, {
      signal: ac.signal,
      // Some CDNs require a UA/referrer; keep it simple but "real".
      headers: {
        "User-Agent": "Mozilla/5.0 (WoC Welcome Card Renderer)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return "";
    if (!ct.startsWith("image/")) return ""; // If Freepik returns HTML, ignore it

    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > maxBytes) return "";

    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) return "";

    const b64 = Buffer.from(ab).toString("base64");
    return `data:${ct};base64,${b64}`;
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
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
        hint: "Use /api/guilds/<guildId>/welcome-card.png or ?guildId=<guildId>. Add ?debug=1 to inspect.",
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

  const title = url.searchParams.get("title") || `${username} just joined the server`;
  const subtitle = url.searchParams.get("subtitle") || (membercount ? `Member #${membercount}` : "");

  const backgroundUrl = url.searchParams.get("backgroundUrl") || "";
  const serverIconUrl = url.searchParams.get("serverIconUrl") || "";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const showAvatar = url.searchParams.get("showAvatar") === "true";

  // ✅ Force non-white defaults
  const backgroundColor = safeHex(url.searchParams.get("backgroundColor"), "#0b1020");
  const textColor = safeHex(url.searchParams.get("textColor"), "#ffffff");
  const overlayOpacity = clamp01(url.searchParams.get("overlayOpacity"), 0.35);

  const { r, g, b } = hexToRgb(backgroundColor);

  // 🔥 Critical: prefetch remote images and only embed if they are truly images.
  // This avoids Freepik/blocked hotlinks returning HTML and breaking the render.
  const [bgDataUrl, iconDataUrl, avatarDataUrl] = await Promise.all([
    fetchImageAsDataUrl(backgroundUrl),
    fetchImageAsDataUrl(serverIconUrl),
    fetchImageAsDataUrl(avatarUrl),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "48px",
          position: "relative",
          backgroundColor, // if everything else fails, still not white
          color: textColor,
          fontFamily: "system-ui, Segoe UI, Inter, Arial",
          overflow: "hidden",
        }}
      >
        {/* Background image (only if we successfully fetched it as an actual image) */}
        {bgDataUrl ? (
          <img
            src={bgDataUrl}
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

        {/* Overlay (tint) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(${r},${g},${b},${overlayOpacity})`,
          }}
        />

        {/* Subtle border glow so even “no images” looks intentional */}
        <div
          style={{
            position: "absolute",
            inset: "18px",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        />

        {/* Left: server */}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: "18px",
            alignItems: "center",
            minWidth: "320px",
          }}
        >
          {iconDataUrl ? (
            <img src={iconDataUrl} alt="" width="84" height="84" style={{ borderRadius: "24px" }} />
          ) : (
            <div
              style={{
                width: "84px",
                height: "84px",
                borderRadius: "24px",
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            />
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "22px", opacity: 0.95 }}>{serverName}</div>
            <div style={{ fontSize: "14px", opacity: 0.75 }}>
              {tag ? `${tag} • ` : ""}
              guildId: {guildId}
            </div>
          </div>
        </div>

        {/* Middle text */}
        <div style={{ position: "relative", flex: 1, padding: "0 32px" }}>
          <div style={{ fontSize: "44px", fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: "22px", marginTop: "10px", opacity: 0.9 }}>{subtitle}</div>
          ) : null}
        </div>

        {/* Right: avatar */}
        <div
          style={{
            position: "relative",
            width: "160px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {showAvatar && avatarDataUrl ? (
            <img
              src={avatarDataUrl}
              alt=""
              width="120"
              height="120"
              style={{
                borderRadius: "36px",
                border: "3px solid rgba(255,255,255,0.25)",
              }}
            />
          ) : (
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "36px",
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
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
