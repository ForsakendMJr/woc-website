// app/api/guilds/[guildId]/welcome-card.png/route.js
import { ImageResponse } from "next/og";

export const runtime = "edge"; // required for next/og

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pick(q, key, fallback = "") {
  const v = q.get(key);
  if (v == null) return fallback;
  const s = String(v).trim();
  return s ? s : fallback;
}

function pickBool(q, key, fallback = true) {
  const v = q.get(key);
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(s)) return false;
  if (["1", "true", "yes", "on"].includes(s)) return true;
  return fallback;
}

function safeHex(input, fallback) {
  const s = String(input || "").trim();
  if (!s) return fallback;
  const hex = s.startsWith("#") ? s : `#${s}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

export async function GET(req, { params }) {
  const { searchParams } = new URL(req.url);

  const guildId = params?.guildId || "";

  // Preview/user fields
  const serverName = pick(searchParams, "serverName", "Your Server");
  const serverIconUrl = pick(searchParams, "serverIconUrl", "");
  const userName = pick(searchParams, "userName", "New Member");
  const tag = pick(searchParams, "tag", `${userName}#0001`);
  const memberCount = pick(searchParams, "memberCount", "1337");
  const avatarUrl = pick(
    searchParams,
    "avatarUrl",
    "https://cdn.discordapp.com/embed/avatars/0.png"
  );

  // Card config (from dashboard)
  const title = pick(searchParams, "title", `${userName} joined ${serverName}`);
  const subtitle = pick(searchParams, "subtitle", `Member #${memberCount}`);
  const bgUrl = pick(searchParams, "backgroundUrl", "");

  const bgColor = safeHex(pick(searchParams, "backgroundColor", "#0b1020"), "#0b1020");
  const textColor = safeHex(pick(searchParams, "textColor", "#ffffff"), "#ffffff");

  const overlayOpacity = clamp(
    Number(pick(searchParams, "overlayOpacity", "0.35")),
    0,
    1
  );

  const showAvatar = pickBool(searchParams, "showAvatar", true);

  // Size: feel free to change later
  const width = 960;
  const height = 320;

  // A very “Mee6-ish” layout, but WoC styled:
  // - glass overlay
  // - gradient rim
  // - server badge pill
  // - soft noise-ish vibe via layered gradients
  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          background: bgUrl
            ? `url(${bgUrl}) center / cover no-repeat`
            : bgColor,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
        }}
      >
        {/* Rim glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, rgba(124,58,237,0.55), rgba(34,211,238,0.18), rgba(244,63,94,0.22))",
            opacity: 0.65,
          }}
        />

        {/* Darken overlay for legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(800px 260px at 20% 10%, rgba(0,0,0,0.0), rgba(0,0,0,0.55))",
          }}
        />

        {/* Glass sheet */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(0,0,0,${overlayOpacity})`,
            backdropFilter: "blur(8px)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            gap: 20,
            padding: 26,
            width: "100%",
            height: "100%",
            alignItems: "center",
          }}
        >
          {/* Avatar / left */}
          {showAvatar ? (
            <div
              style={{
                width: 126,
                height: 126,
                borderRadius: 28,
                overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.22)",
                boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt="avatar"
                width={126}
                height={126}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : null}

          {/* Main text */}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* server badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              {serverIconUrl ? (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={serverIconUrl}
                    alt="server"
                    width={34}
                    height={34}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                />
              )}

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                {serverName}
              </div>

              <div
                style={{
                  marginLeft: "auto",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.14)",
                  border: "1px solid rgba(16,185,129,0.26)",
                  color: "rgba(209,250,229,0.95)",
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                Member #{memberCount}
              </div>
            </div>

            <div
              style={{
                color: textColor,
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: -0.6,
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 740,
                textShadow: "0 10px 30px rgba(0,0,0,0.45)",
              }}
            >
              {title}
            </div>

            <div
              style={{
                marginTop: 10,
                color: "rgba(255,255,255,0.82)",
                fontSize: 18,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 740,
              }}
            >
              {subtitle}
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "rgba(255,255,255,0.70)",
                fontSize: 14,
              }}
            >
              <div
                style={{
                  padding: "7px 10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                {tag}
              </div>

              <div style={{ opacity: 0.85 }}>
                WoC Welcome Card · {guildId ? `Guild ${guildId}` : "Preview"}
              </div>
            </div>
          </div>
        </div>

        {/* Tiny corner accent */}
        <div
          style={{
            position: "absolute",
            right: -80,
            top: -80,
            width: 220,
            height: 220,
            borderRadius: 999,
            background:
              "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.35), rgba(124,58,237,0.0) 60%)",
          }}
        />
      </div>
    ),
    {
      width,
      height,
    }
  );
}
