import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";
export const runtime = "edge";

// ---------- helpers ----------
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

function safeText(input, max = 240) {
  const s = String(input || "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function safeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.length > 1400) return ""; // guard: query strings can get gnarly
  try {
    const url = new URL(s);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function fetchImageAsArrayBuffer(url) {
  const u = safeUrl(url);
  if (!u) return null;

  // Tiny timeout to avoid hanging renders
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2500);

  try {
    const res = await fetch(u, {
      cache: "no-store",
      signal: ac.signal,
      headers: { Accept: "image/*" },
    });

    if (!res.ok) return null;

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("image/")) return null;

    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 32) return null;

    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------- route ----------
export async function GET(req, ctx) {
  const url = new URL(req.url);
  const guildId = getGuildId(req, ctx);

  // 🔎 Debug mode (kept)
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
  const serverName = safeText(url.searchParams.get("serverName") || "Server", 80);
  const username = safeText(url.searchParams.get("username") || "New Member", 60);
  const tag = safeText(url.searchParams.get("tag") || "", 40);
  const membercount = safeText(url.searchParams.get("membercount") || "", 12);

  const title = safeText(
    url.searchParams.get("title") || `${username} just joined the server`,
    80
  );
  const subtitle = safeText(
    url.searchParams.get("subtitle") || (membercount ? `Member #${membercount}` : ""),
    60
  );

  const backgroundUrl = url.searchParams.get("backgroundUrl") || "";
  const serverIconUrl = url.searchParams.get("serverIconUrl") || "";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const showAvatar = url.searchParams.get("showAvatar") === "true";

  // Defaults (never white unless asked)
  const backgroundColor = safeHex(url.searchParams.get("backgroundColor"), "#0b1020");
  const textColor = safeHex(url.searchParams.get("textColor"), "#ffffff");
  const overlayOpacity = clamp01(url.searchParams.get("overlayOpacity"), 0.35);

  const { r, g, b } = hexToRgb(backgroundColor);

  // ✅ Pre-fetch images to avoid flakey <img src="https://..."> inside the renderer
  const [bgBuf, iconBuf, avatarBuf] = await Promise.all([
    fetchImageAsArrayBuffer(backgroundUrl),
    fetchImageAsArrayBuffer(serverIconUrl),
    fetchImageAsArrayBuffer(avatarUrl),
  ]);

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
            padding: 44,
            position: "relative",
            backgroundColor,
            color: textColor,
            fontFamily: "system-ui, Segoe UI, Inter, Arial",
            overflow: "hidden",
          }}
        >
          {/* Background image (bytes) */}
          {bgBuf ? (
            <img
              src={bgBuf}
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

          {/* Dark overlay for readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: `rgba(${r},${g},${b},${overlayOpacity})`,
            }}
          />

          {/* Accent glow blobs (unique styling, still OG-safe) */}
          <div
            style={{
              position: "absolute",
              left: -120,
              top: -140,
              width: 520,
              height: 520,
              borderRadius: 520,
              background: "rgba(124,58,237,0.22)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -140,
              bottom: -180,
              width: 560,
              height: 560,
              borderRadius: 560,
              background: "rgba(16,185,129,0.16)",
            }}
          />

          {/* Glass-ish panel (no backdropFilter, OG-safe) */}
          <div
            style={{
              position: "absolute",
              inset: 22,
              borderRadius: 34,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
            }}
          />

          {/* Left: server block */}
          <div
            style={{
              position: "relative",
              display: "flex",
              gap: 16,
              alignItems: "center",
              minWidth: 340,
            }}
          >
            {iconBuf ? (
              <img
                src={iconBuf}
                alt=""
                width={86}
                height={86}
                style={{
                  borderRadius: 26,
                  border: "2px solid rgba(255,255,255,0.20)",
                  background: "rgba(255,255,255,0.10)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: 26,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(255,255,255,0.12)",
                }}
              />
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 14, opacity: 0.78, letterSpacing: 1.2 }}>
                WELCOME
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, opacity: 0.96 }}>
                {serverName}
              </div>
              <div style={{ fontSize: 13, opacity: 0.72 }}>
                {tag ? `${tag} • ` : ""}guildId: {guildId}
              </div>
            </div>
          </div>

          {/* Middle: text */}
          <div style={{ position: "relative", flex: 1, padding: "0 34px" }}>
            <div
              style={{
                fontSize: 46,
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: -0.6,
              }}
            >
              {title}
            </div>

            {subtitle ? (
              <div style={{ fontSize: 22, marginTop: 12, opacity: 0.9 }}>
                {subtitle}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 16,
                display: "inline-flex",
                gap: 10,
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.18)",
                fontSize: 13,
                opacity: 0.92,
              }}
            >
              <span style={{ opacity: 0.9 }}>User:</span>
              <span style={{ fontWeight: 700 }}>{username}</span>
              {membercount ? (
                <span style={{ opacity: 0.85 }}>• Member #{membercount}</span>
              ) : null}
            </div>
          </div>

          {/* Right: avatar */}
          <div
            style={{
              position: "relative",
              width: 170,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            {showAvatar && avatarBuf ? (
              <div
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: 42,
                  padding: 4,
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.16)",
                }}
              >
                <img
                  src={avatarBuf}
                  alt=""
                  width={120}
                  height={120}
                  style={{
                    borderRadius: 38,
                    border: "2px solid rgba(255,255,255,0.22)",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: 42,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(255,255,255,0.12)",
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
      JSON.stringify(
        { error: "Image render failed", message: String(e?.message || e) },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
