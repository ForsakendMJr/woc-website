import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/_authOptions";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function absUrl(path = "/") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return new URL(path, base).toString();
}

function getTierForLevel(levelRaw) {
  const level = String(levelRaw || "1").trim();
  if (level === "1") return "supporter";
  if (level === "2") return "supporter_plus";
  if (level === "3") return "supporter_plus_plus";
  return "free";
}

function getPriceIdForLevel(levelRaw) {
  const level = String(levelRaw || "1").trim();

  if (level === "1") return process.env.STRIPE_PRICE_WOC_L1;
  if (level === "2") return process.env.STRIPE_PRICE_WOC_L2;
  if (level === "3") return process.env.STRIPE_PRICE_WOC_L3;

  // optional fallback for testing (level=test etc)
  return process.env.STRIPE_PRICE_TEST_ZERO;
}

function pickDiscordId(session) {
  const u = session?.user || {};
  const candidates = [u.discordId, u.id, u.sub, session?.sub].filter(Boolean);
  const id = String(candidates[0] || "").trim();
  return /^[0-9]{17,20}$/.test(id) ? id : "";
}

// ✅ GET: /api/premium/checkout?level=1
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "Not signed in." },
        { status: 401 }
      );
    }

    const discordId = pickDiscordId(session);
    if (!discordId) {
      return NextResponse.json(
        { error: "Discord ID missing from session." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level") || "1";

    const priceId = getPriceIdForLevel(level);
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing priceId env for this level." },
        { status: 400 }
      );
    }

    const tier = getTierForLevel(level);

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absUrl("/premium/success?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: absUrl("/premium/cancel"),
      allow_promotion_codes: true,

      // 👇 this links Stripe -> your user
      client_reference_id: discordId,
      metadata: {
        discordId,
        woc_level: String(level),
        woc_tier: tier,
      },
    });

    return NextResponse.redirect(checkout.url, 303);
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Checkout creation failed." },
      { status: 500 }
    );
  }
}

// ✅ POST: { level: "1" }
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "Not signed in." },
        { status: 401 }
      );
    }

    const discordId = pickDiscordId(session);
    if (!discordId) {
      return NextResponse.json(
        { error: "Discord ID missing from session." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const level = String(body?.level || "1");

    const priceId = getPriceIdForLevel(level);
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing priceId env for this level." },
        { status: 400 }
      );
    }

    const tier = getTierForLevel(level);

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absUrl("/premium/success?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: absUrl("/premium/cancel"),
      allow_promotion_codes: true,

      client_reference_id: discordId,
      metadata: {
        discordId,
        woc_level: String(level),
        woc_tier: tier,
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Checkout creation failed." },
      { status: 500 }
    );
  }
}
