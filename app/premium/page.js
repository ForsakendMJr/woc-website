// app/premium/page.js
"use client";

import { useEffect, useState } from "react";

export default function PremiumPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/premium/status", { cache: "no-store" });
      const json = await res.json();
      setStatus(json);
    } catch (e) {
      setStatus({ ok: false, error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function goCheckout(level) {
    window.location.href = `/api/premium/checkout?level=${encodeURIComponent(level)}`;
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1>WoC Premium</h1>
      <p>Manage your subscription and unlock premium features.</p>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #2a2a2a", borderRadius: 12 }}>
        <h3>Your status</h3>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(status, null, 2)}</pre>
        )}
        <button onClick={loadStatus} style={{ marginTop: 10 }}>
          Refresh status
        </button>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => goCheckout("test")}>Testing</button>
        <button onClick={() => goCheckout("1")}>Buy Level 1</button>
        <button onClick={() => goCheckout("2")}>Buy Level 2</button>
        <button onClick={() => goCheckout("3")}>Buy Level 3</button>
      </div>

      <div style={{ marginTop: 18 }}>
        <a href="/dashboard">Back to dashboard</a>
      </div>
    </div>
  );
}
