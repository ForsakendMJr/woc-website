// app/api/premium/portal/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/_authOptions";

import dbConnect from "../../../../lib/mongodb";
import PremiumUser from "../../../models/PremiumUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function absUrl(path = "/") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return new URL(path, base).toString();
}

function pickDiscordId(session) {
  const u = session?.user || {};
  const candidates = [u.discordId, u.id, u.sub, session?.sub].filter(Boolean);
  const id = String(candidates[0] || "").trim();
  return /^[0-9]{17,20}$/.test(id) ? id : "";
}

// GET /api/premium/portal  -> returns { url }
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
    }

    const discordId = pickDiscordId(session);
    if (!discordId) {
      return NextResponse.json(
        { ok: false, error: "Discord ID missing from session." },
        { status: 400 }
      );
    }

    await dbConnect();
    const doc = await PremiumUser.findOne({ discordId }).lean();

    const stripeCustomerId = doc?.meta?.stripeCustomerId || null;
    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No Stripe customer id found for your account yet. If you just purchased, wait a moment and refresh, or click Sync Discord roles first.",
        },
        { status: 400 }
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: absUrl("/premium"),
    });

    return NextResponse.json({ ok: true, url: portal.url }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
