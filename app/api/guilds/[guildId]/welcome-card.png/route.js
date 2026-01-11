// app/api/guilds/[guildId]/welcome-card.png/route.js
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function asStr(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}
function asBool(v, fallback = false) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  return s === "true" || s === "1" || s === "yes" || s === "on";
}
function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function safeHex(v, fallback) {
  const s = String(v ?? "").trim();
  if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return fallback;
}

function backgroundLayer(backgroundUrl, backgroundColor) {
  // If the URL is not direct / blocked, the image just won't render.
  // The gradient + backgroundColor still makes it look good.
  return [
    // base gradient
    `linear-gradient(135deg, rgba(11,16,32,1) 0%, rgba(7,10,18,1) 55%, rgba(18,8,24,1) 100%)`,
    // user chosen base color (subtle wash)
    `linear-gradient(0deg, ${backgroundColor}55, ${backgroundColor}55)`,
    // optional background image
    backgroundUrl ? `url(${backgroundUrl})` : null,
  ].filter(Boolean).join(", ");
}

export async function GET(req, { params }) {
  const { searchParams } = new URL(req.url);

  const guildId = asStr(params?.guildId, "");
  if (!guildId) {
    return new Response(JSON.stringify({ error: "Missing guildId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const serverName = asStr(searchParams.get("serverName"), "Server");
  const username = asStr(searchParams.get("username"), "New Member");
  const tag = asStr(searchParams.get("tag"), "");
  const membercount = asStr(searchParams.get("membercount"), "");
  const title = asStr(searchParams.get("title"), `${username} just joined the server`);
  const subtitle = asStr(
    searchParams.get("subtitle"),
    membercount ? `Member #${membercount}` : "Welcome!"
  );

  const serverIconUrl = asStr(searchParams.get("serverIconUrl"), "");
  const avatarUrl = asStr(searchParams.get("avatarUrl"), "");
  const backgroundUrl = asStr(searchParams.get("backgroundUrl"), "");

  const backgroundColor = safeHex(searchParams.get("backgroundColor"), "#0b1020");
  const textColor = safeHex(searchParams.get("textColor"), "#ffffff");
  const overlayOpacity = clamp(asNum(searchParams.get("overlayOpacity"), 0.35), 0, 1);
  const showAvatar = asBool(searchParams.get("showAvatar"), true);

  // IMPORTANT: Vercel/Edge may block some hosts from hotlinking (Freepik often fails).
  // Prefer direct image hosts (Discord CDN, Imgur direct, Unsplash, your own).
  const bg = backgroundLayer(backgroundUrl, backgroundColor);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1024px",
          height: "360px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(135deg, #070a12, #120818)",
        }}
      >
        <div
          style={{
            width: "980px",
            height: "316px",
            borderRadius: 26,
            overflow: "hidden",
            position: "relative",
            border: "2px solid rgba(255,255,255,0.14)",
            backgroundImage: bg,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            padding: 28,
            boxSizing: "border-box",
          }}
        >
          {/* top glow bar */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 8,
              width: "100%",
              background:
                "linear-gradient(90deg, rgba(124,58,237,0.75), rgba(59,130,246,0.35), rgba(244,63,94,0.65))",
            }}
          />

          {/* overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(0,0,0,${overlayOpacity})`,
            }}
          />

          {/* accent slashes */}
          <div
            style={{
              position: "absolute",
              right: -120,
              top: -80,
              width: 260,
              height: 520,
              transform: "rotate(-18deg)",
              background: "rgba(124,58,237,0.35)",
              filter: "blur(0px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -160,
              top: -80,
              width: 220,
              height: 520,
              transform: "rotate(-18deg)",
              background: "rgba(244,63,94,0.22)",
              filter: "blur(0px)",
            }}
          />

          {/* content */}
          <div style={{ position: "relative", display: "flex", width: "100%", height: "100%" }}>
            {/* left column */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {/* server icon */}
                <div
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 999,
                    overflow: "hidden",
                    background:
                      "linear-gradient(135deg, rgba(124,58,237,0.9), rgba(244,63,94,0.75))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  {serverIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={serverIconUrl}
                      width="62"
                      height="62"
                      style={{ objectFit: "cover" }}
                      alt=""
                    />
                  ) : (
                    serverName.slice(0, 1).toUpperCase()
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, fontWeight: 700 }}>
                    {serverName}
                  </div>
                  {tag ? (
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 600 }}>
                      {tag.startsWith("@") ? tag : `@${tag}`}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ marginTop: 22, color: textColor, fontSize: 44, fontWeight: 900, lineHeight: 1.05 }}>
                {title}
              </div>

              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.78)", fontSize: 20, fontWeight: 700 }}>
                {subtitle}
              </div>

              <div style={{ marginTop: "auto", color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 600 }}>
                World of Communities • Welcome System
              </div>
            </div>

            {/* avatar */}
            {showAvatar ? (
              <div style={{ width: 170, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <div
                  style={{
                    width: 112,
                    height: 112,
                    borderRadius: 999,
                    padding: 6,
                    background:
                      "linear-gradient(135deg, rgba(124,58,237,0.9), rgba(244,63,94,0.8))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 999,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        width="100"
                        height="100"
                        style={{ objectFit: "cover" }}
                        alt=""
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: 1024,
      height: 360,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
