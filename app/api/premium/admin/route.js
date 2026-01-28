import { NextResponse } from "next/server";
import dbConnect from "../../lib/mongodb";
import PremiumUser from "../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSnowflake(id) {
  return /^[0-9]{17,20}$/.test(String(id || "").trim());
}

function authed(req) {
  const token = process.env.PREMIUM_ADMIN_TOKEN || "";
  const got = req.headers.get("x-premium-admin-token") || "";
  return token && got && got === token;
}

export async function POST(req) {
  try {
    if (!authed(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const discordId = String(body.discordId || "").trim();
    const tier = String(body.tier || "supporter").trim();
    const active = body.active !== false;

    // expiresInDays optional (number). If omitted -> no expiry.
    const expiresInDays =
      body.expiresInDays == null ? null : Number(body.expiresInDays);

    const note = String(body.note || "").slice(0, 240);

    if (!isSnowflake(discordId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid discordId (snowflake required)." },
        { status: 400 }
      );
    }

const allowed = new Set([
  "free",
  "supporter",
  "supporter_plus",
  "supporter_plus_plus",
]);

    if (!allowed.has(tier)) {
      return NextResponse.json(
        { ok: false, error: `Invalid tier. Allowed: ${Array.from(allowed).join(", ")}` },
        { status: 400 }
      );
    }

    const expiresAt =
      expiresInDays == null
        ? null
        : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await dbConnect();

    const doc = await PremiumUser.findOneAndUpdate(
      { discordId },
      { $set: { tier, active, expiresAt, note } },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({ ok: true, user: doc }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    if (!authed(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const discordId = String(body.discordId || "").trim();

    if (!isSnowflake(discordId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid discordId (snowflake required)." },
        { status: 400 }
      );
    }

    await dbConnect();
    await PremiumUser.deleteOne({ discordId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
