// app/api/guilds/[guildId]/welcome-card.png/route.js
import { ImageResponse } from "next/og";

export const runtime = "edge";

function clamp(n, min, max) {
  n = Number.isFinite(n) ? n : min;
  return Math.max(min, Math.min(max, n));
}

function toHexColor(input, fallback) {
  const s = String(input || "").trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return fallback;
}

function safeText(input, fallback = "") {
  const s = String(input ?? "").trim();
  return s || fallback;
}

async function fetchAsDataUrl(url) {
  try {
    const u = String(url || "").trim();
    if (!u || !/^https?:\/\//i.test(u)) return null;

    const res = await fetch(u, {
      // some CDNs behave better with a UA
      headers: { "user-agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "image/png";
    const buf = await res.arrayBuffer();

    // Convert to base64
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);

    const guildId = String(params?.guildId || "").trim();

    // Incoming params (your dashboard builds these)
    const serverName = safeText(searchParams.get("serverName"), "Your Server");
    const serverIconUrl = searchParams.get("serverIconUrl") || "";
    const avatarUrl = searchParams.get("avatarUrl") || "";
    const username = safeText(searchParams.get("username"), "New Member");
    const tag = safeText(searchParams.get("tag"), "user#0000");
    const membercount = safeText(searchParams.get("membercount"), "???");

    const title = safeText(searchParams.get("title"), `${username} just joined`);
    const subtitle = safeText(searchParams.get("subtitle"), `Member #${membercount}`);

    const backgroundUrl = searchParams.get("backgroundUrl") || "";
    const backgroundColor = toHexColor(searchParams.get("backgroundColor"), "#0b1020");
    const textColor = toHexColor(searchParams.get("textColor"), "#ffffff");

    const overlayOpacity = clamp(parseFloat(searchParams.get("overlayOpacity") ?? "0.35"), 0, 1);

    const showAvatarRaw = String(searchParams.get("showAvatar") ?? "true").toLowerCase();
    const showAvatar = showAvatarRaw !== "false";

    // Fetch remote images safely (if they fail, we keep going)
    const [bgData, avatarData, iconData] = await Promise.all([
      fetchAsDataUrl(backgroundUrl),
      fetchAsDataUrl(avatarUrl),
      fetchAsDataUrl(serverIconUrl),
    ]);

    // Small anti-cache salt if you want (optional)
    // const salt = searchParams.get("t") || "";

    // Style tokens
    const neonA = "#7c3aed"; // purple
    const neonB = "#06b6d4"; // cyan
    const neonC = "#ef4444"; // red

    const cardW = 1100;
    const cardH = 340;

    return new ImageResponse(
      (
        <div
          style={{
            width: cardW,
            height: cardH,
            display: "flex",
            position: "relative",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
            borderRadius: 28,
            overflow: "hidden",
            background: backgroundColor,
          }}
        >
          {/* BACKGROUND LAYER */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: bgData
                ? `url(${bgData})`
                : `radial-gradient(900px 380px at 10% 15%, rgba(124,58,237,0.35), transparent 60%),
                   radial-gradient(800px 360px at 85% 30%, rgba(6,182,212,0.28), transparent 55%),
                   radial-gradient(700px 400px at 70% 90%, rgba(239,68,68,0.18), transparent 60%),
                   linear-gradient(135deg, #0b1020, #070a14)`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: bgData ? "saturate(1.1) contrast(1.05)" : "none",
              transform: "scale(1.02)",
            }}
          />

          {/* OVERLAY for readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(90deg,
                rgba(0,0,0,${overlayOpacity + 0.15}) 0%,
                rgba(0,0,0,${overlayOpacity}) 45%,
                rgba(0,0,0,${overlayOpacity + 0.18}) 100%)`,
            }}
          />

          {/* NEON FRAME */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow:
                "0 20px 80px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: -2,
              borderRadius: 30,
              background: `conic-gradient(from 200deg, ${neonA}, ${neonB}, ${neonC}, ${neonA})`,
              opacity: 0.18,
              filter: "blur(18px)",
            }}
          />

          {/* CONTENT */}
          <div
            style={{
              position: "relative",
              display: "flex",
              gap: 22,
              padding: 30,
              width: "100%",
              height: "100%",
              alignItems: "center",
            }}
          >
            {/* LEFT: AVATAR */}
            {showAvatar ? (
              <div
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 999,
                  overflow: "hidden",
                  flexShrink: 0,
                  position: "relative",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: -10,
                    background: `radial-gradient(circle at 30% 30%, rgba(124,58,237,0.55), transparent 55%),
                                 radial-gradient(circle at 70% 70%, rgba(6,182,212,0.35), transparent 60%)`,
                    filter: "blur(12px)",
                  }}
                />
                {avatarData ? (
                  <img
                    src={avatarData}
                    alt="avatar"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      position: "relative",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 54,
                      fontWeight: 800,
                    }}
                  >
                    {safeText(username?.[0], "U").toUpperCase()}
                  </div>
                )}
              </div>
            ) : null}

            {/* MIDDLE: TEXT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 18,
                }}
              >
                {/* server icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {iconData ? (
                    <img
                      src={iconData}
                      alt="server icon"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700 }}>WoC</div>
                  )}
                </div>

                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {serverName}
                </div>

                <div
                  style={{
                    marginLeft: "auto",
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.25)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  #{membercount}
                </div>
              </div>

              <div
                style={{
                  fontSize: 46,
                  fontWeight: 900,
                  letterSpacing: -1,
                  color: textColor,
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textShadow: "0 10px 40px rgba(0,0,0,0.50)",
                }}
              >
                {title}
              </div>

              <div
                style={{
                  fontSize: 22,
                  color: "rgba(255,255,255,0.82)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {subtitle}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 16,
                  }}
                >
                  {tag}
                </div>

                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(124,58,237,0.30)",
                    background: "rgba(124,58,237,0.10)",
                    color: "rgba(255,255,255,0.90)",
                    fontSize: 16,
                  }}
                >
                  guild: {guildId || "?"}
                </div>
              </div>
            </div>

            {/* RIGHT: ACCENT STRIP */}
            <div
              style={{
                width: 14,
                height: "84%",
                borderRadius: 999,
                background: `linear-gradient(180deg, ${neonA}, ${neonB}, ${neonC})`,
                opacity: 0.9,
                boxShadow: "0 0 35px rgba(124,58,237,0.45)",
              }}
            />
          </div>
        </div>
      ),
      {
        width: cardW,
        height: cardH,
        headers: {
          // prevent “stuck” previews while you iterate
          "Cache-Control": "no-store, max-age=0",
          "Content-Type": "image/png",
        },
      }
    );
  } catch (err) {
    // If something explodes, return a tiny PNG-like error image as text (so you can see it in devtools)
    const msg = String(err?.message || err || "Failed to render image.");
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }
    );
  }
}
