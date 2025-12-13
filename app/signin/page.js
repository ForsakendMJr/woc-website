"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="woc-card p-6">
        <h1 className="text-xl font-semibold mb-2">Sign in</h1>
        <p className="text-[var(--text-muted)] mb-4">
          Sign in with Discord to access the WoC dashboard.
        </p>
        <button className="woc-btn-primary" onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}>
          Continue with Discord
        </button>
      </div>
    </div>
  );
}
