import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // ✅ no apiVersion

function absUrl(path = "/") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return new URL(path, base).toString();
}

function getPriceIdForLevel(levelRaw) {
  const level = String(levelRaw || "1").trim();

  if (level === "1") return process.env.STRIPE_PRICE_WOC_LEVEL_1;
  if (level === "2") return process.env.STRIPE_PRICE_WOC_LEVEL_2;
  if (level === "3") return process.env.STRIPE_PRICE_WOC_LEVEL_3;

  // optional fallback for testing
  return process.env.STRIPE_PRICE_TEST_ZERO;
}

// ✅ GET: /api/premium/checkout?level=1
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level") || "1";

    const priceId = getPriceIdForLevel(level);
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing priceId env for this level." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absUrl("/premium/success?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: absUrl("/premium/cancel"),
      allow_promotion_codes: true,
      metadata: { woc_level: String(level) },
    });

    return NextResponse.redirect(session.url, 303);
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
    const body = await req.json().catch(() => ({}));
    const level = String(body?.level || "1");

    const priceId = getPriceIdForLevel(level);
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing priceId env for this level." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absUrl("/premium/success?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: absUrl("/premium/cancel"),
      allow_promotion_codes: true,
      metadata: { woc_level: String(level) },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Checkout creation failed." },
      { status: 500 }
    );
  }
}
