import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import GuildSettings from "@/app/models/GuildSettings";

export const dynamic = "force-dynamic";

/* ---------------------------------------------------- */
/* utils */
/* ---------------------------------------------------- */

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || ""));
}

function deepMerge(target, source) {
  if (typeof target !== "object" || target === null) return source;
  if (typeof source !== "object" || source === null) return target;

  const out = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];

    if (
      sv &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      out[key] = deepMerge(tv, sv);
    } else {
      out[key] = sv;
    }
  }

  return out;
}

/* ---------------------------------------------------- */
/* GET – fetch settings */
/* ---------------------------------------------------- */

export async function GET(req, { params }) {
  const guildId = params?.guildId;

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid guildId" },
      { status: 400 }
    );
  }

  await dbConnect();

  let doc = await GuildSettings.findOne({ guildId }).lean();

  if (!doc) {
    doc = await GuildSettings.create({ guildId });
  }

  return NextResponse.json({ ok: true, settings: doc });
}

/* ---------------------------------------------------- */
/* PATCH – save settings (dashboard) */
/* ---------------------------------------------------- */

export async function PATCH(req, { params }) {
  const guildId = params?.guildId;

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid guildId" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  await dbConnect();

  const existing =
    (await GuildSettings.findOne({ guildId }).lean()) || { guildId };

  // 🔥 THIS is the critical fix
  const merged = deepMerge(existing, body);

  // Always force guildId consistency
  merged.guildId = guildId;

  const updated = await GuildSettings.findOneAndUpdate(
    { guildId },
    merged,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return NextResponse.json({ ok: true, settings: updated });
}
