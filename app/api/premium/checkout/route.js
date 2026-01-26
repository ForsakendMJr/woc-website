import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Stripe SDK wants Node runtime

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-18.clover", // ok if Stripe ignores/overrides; works with current SDK
});

function absUrl(path = "/") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return new URL(path, base).toString();
}

// ✅ GET for easy testing in browser:
// /api/premium/checkout?level=1
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level") || "1";

    const priceId =
      level === "1"
        ? process.env.STRIPE_PRICE_WOC_L1
        : level === "2"
        ? process.env.STRIPE_PRICE_WOC_L2
        : level === "3"
        ? process.env.STRIPE_PRICE_WOC_L3
        : process.env.STRIPE_PRICE_TEST_ZERO;

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
      // Optional: set this if you want Stripe to collect email
      // customer_email: "optional",
      allow_promotion_codes: true,
      metadata: {
        woc_level: String(level),
      },
    });

    // If you open this endpoint in browser, redirect straight to Stripe checkout
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Checkout creation failed." },
      { status: 500 }
    );
  }
}

// ✅ POST if your frontend uses fetch("/api/premium/checkout", {method:"POST"})
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const level = String(body?.level || "1");

    const priceId =
      level === "1"
        ? process.env.STRIPE_PRICE_WOC_L1
        : level === "2"
        ? process.env.STRIPE_PRICE_WOC_L2
        : level === "3"
        ? process.env.STRIPE_PRICE_WOC_L3
        : process.env.STRIPE_PRICE_TEST_ZERO;

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
      metadata: {
        woc_level: String(level),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Checkout creation failed." },
      { status: 500 }
    );
  }
}
