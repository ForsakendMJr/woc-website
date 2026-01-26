import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// IMPORTANT: fix this import to YOUR actual authOptions export.
import { authOptions } from "../../auth/[...nextauth]/route";

import dbConnect from "../../../../lib/mongodb";
import PremiumUser, { TIER_ORDER } from "../../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeTier(t) {
  const x = String(t || "free").trim().toLowerCase();
  return TIER_ORDER.includes(x) ? x : "free";
}

function tierRank(t) {
  const i = TIER_ORDER.indexOf(normalizeTier(t));
  return i === -1 ? 0 : i;
}

function computeActive({ tier, expiresAt }) {
  const t = normalizeTier(tier);
  if (t === "free") return false;

  if (!expiresAt) return true; // lifetime
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return true;

  return exp.getTime() > Date.now();
}

function pickDiscordId(session) {
  const u = session?.user || {};
  const candidates = [u.discordId, u.id, u.sub, session?.sub].filter(Boolean);
  const id = String(candidates[0] || "").trim();
  return /^[0-9]{17,20}$/.test(id) ? id : "";
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ ok: true, authed: false, premium: false, tier: "free" });
    }

    const url = new URL(req.url);

    // dev testing override (optional)
    const devOverride = url.searchParams.get("discordId") || "";
    const isDev = process.env.NODE_ENV !== "production";

    const discordId =
      (isDev && /^[0-9]{17,20}$/.test(devOverride) ? devOverride : "") ||
      pickDiscordId(session);

    if (!discordId) {
      return NextResponse.json({
        ok: true,
        authed: true,
        premium: false,
        tier: "free",
        warning:
          "Signed in, but Discord ID missing from session. Ensure NextAuth sets session.user.id to the Discord snowflake.",
      });
    }

    await dbConnect();

    let doc = await PremiumUser.findOne({ discordId }).lean();

    // Create default record if missing (optional but handy)
    if (!doc) {
      const created = await PremiumUser.create({
        discordId,
        tier: "free",
        expiresAt: null,
        note: "",
        meta: {},
      });
      doc = created.toObject();
    }

    const tier = normalizeTier(doc.tier);
    const active = computeActive({ tier, expiresAt: doc.expiresAt });
    const premium = active && tierRank(tier) > 0;

    return NextResponse.json({
      ok: true,
      authed: true,
      discordId,
      premium,
      active,
      tier: premium ? tier : "free",
      expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
      note: doc.note || "",
    });
  } catch (e) {
    console.error("[api/premium/status] error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
