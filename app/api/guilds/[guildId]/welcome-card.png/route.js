import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || ""));
}

export async function GET(req, { params } = {}) {
  const guildId = params?.guildId;

  if (!isSnowflake(guildId)) {
    return new Response(JSON.stringify({ error: "Invalid guildId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Welcome!";
  const subtitle = searchParams.get("subtitle") || "Enjoy your stay";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "400px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background: "linear-gradient(135deg, #0b1020, #1a1f3a)",
          color: "#ffffff",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 28, opacity: 0.85, marginTop: 12 }}>
          {subtitle}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
