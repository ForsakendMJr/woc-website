// app/api/premium/status/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "../../lib/mongodb";

// ✅ IMPORTANT:
// This route uses NextAuth server session. Adjust the import below to match your project.
// Most App Router setups have: /app/api/auth/[...nextauth]/route.js exporting { authOptions }.
import { getServerSession } from "next-auth";

// Try common authOptions locations (works in most repos).
let authOptions = null;
try {
  // eslint-disable-next-line import/no-unresolved
  ({ authOptions } = await import("../auth/[...nextauth]/route.js"));
} catch {
  try {
    // eslint-disable-next-line import/no-unresolved
    ({ authOptions } = await import("../../auth/[...nextauth]/route.js"));
  } catch {
    authOptions = null;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ------------------ Premium model ------------------ **/
const TIER_ORDER = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];

function normalizeTier(t) {
  const x = String(t || "free").trim().toLowerCase();
  return TIER_ORDER.includes(x) ? x : "free";
}

function computePremium({ tier, expiresAt }) {
  const t = normalizeTier(tier);
  if (t === "free") return { premium: false, active: false };

  if (!expiresAt) return { premium: true, active: true };

  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return { premium: true, active: true };

  const active = exp.getTime() > Date.now();
  return { premium: active, active };
}

const PremiumUserSchema =
  mongoose.models.PremiumUser?.schema ||
  new mongoose.Schema(
    {
      discordId: { type: String, required: true, unique: true, index: true },
      tier: {
        type: String,
        enum: TIER_ORDER,
        default: "free",
      },
      // Optional explicit flag (we still compute "active" using expiresAt)
      premium: { type: Boolean, default: false },
      expiresAt: { type: Date, default: null },
      // Freeform metadata for later (Stripe, etc.)
      meta: { type: Object, default: {} },
    },
    { timestamps: true }
  );

const PremiumUser =
  mongoose.models.PremiumUser || mongoose.model("PremiumUser", PremiumUserSchema);

/** ------------------ Helpers ------------------ **/
function safeJson(obj, status = 200) {
  return NextResponse.json(obj, { status });
}

function pickDiscordIdFromSession(session) {
  // Depending on your callbacks, any of these may exist:
  // session.user.id, session.user.sub, session.user.discordId
  const u = session?.user || {};
  const candidates = [u.discordId, u.id, u.sub, session?.sub].filter(Boolean);
  const id = String(candidates[0] || "").trim();
  // Discord snowflake check
  if (!/^[0-9]{17,20}$/.test(id)) return "";
  return id;
}

/** ------------------ Route ------------------ **/
export async function GET(req) {
  try {
    // 1) Auth
    const session = authOptions
      ? await getServerSession(authOptions)
      : await getServerSession();

    if (!session) {
      return safeJson({ ok: false, error: "Not signed in." }, 401);
    }

    // 2) Identify user
    const url = new URL(req.url);

    // Optional dev-only override for testing (remove later if you want)
    const devOverride = url.searchParams.get("discordId") || "";
    const isDev = process.env.NODE_ENV !== "production";

    const discordId =
      (isDev && /^[0-9]{17,20}$/.test(devOverride) ? devOverride : "") ||
      pickDiscordIdFromSession(session);

    if (!discordId) {
      // Don’t hard-fail. Return Free with a warning so your UI doesn’t explode.
      return safeJson({
        ok: true,
        premium: false,
        tier: "free",
        active: false,
        expiresAt: null,
        warning:
          "Signed in, but no Discord ID was found in the session. Add it via NextAuth callbacks (session.user.id) or test with ?discordId=YOUR_ID in dev.",
      });
    }

    // 3) DB lookup
    await dbConnect();

    let record = await PremiumUser.findOne({ discordId }).lean();

    // If no record exists yet, create a default Free record (nice for analytics + future upgrades)
    if (!record) {
      const created = await PremiumUser.create({
        discordId,
        tier: "free",
        premium: false,
        expiresAt: null,
        meta: {},
      });
      record = created.toObject();
    }

    const tier = normalizeTier(record?.tier);
    const expiresAt = record?.expiresAt ? new Date(record.expiresAt).toISOString() : null;

    // Compute active premium from tier + expiry (source of truth)
    const { premium, active } = computePremium({ tier, expiresAt });

    return safeJson({
      ok: true,
      premium, // boolean (active premium)
      active, // alias, handy for UI
      tier, // free | supporter | supporter_plus | supporter_plus_plus
      expiresAt, // ISO or null
    });
  } catch (err) {
    console.error("[premium/status] error:", err);
    return safeJson(
      { ok: false, error: String(err?.message || err || "Unknown error") },
      500
    );
  }
}
