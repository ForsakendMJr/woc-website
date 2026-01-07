// app/api/guilds/[guildId]/channels/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  return NextResponse.json(
    {
      ok: true,
      debug: {
        url: req.url,
        params,
        params_guildId: params?.guildId ?? null,
        search_guildId: (() => {
          try {
            return new URL(req.url).searchParams.get("guildId");
          } catch {
            return null;
          }
        })(),
      },
    },
    { status: 200 }
  );
}
