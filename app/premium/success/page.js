export const dynamic = "force-dynamic";

export default function PremiumSuccessPage({ searchParams }) {
  const sid = searchParams?.session_id || "";
  return (
    <div style={{ padding: 24 }}>
      <h1>Premium purchase started ✅</h1>
      <p>Stripe redirected back successfully.</p>

      {sid ? (
        <p>
          Session: <code>{sid}</code>
        </p>
      ) : (
        <p style={{ opacity: 0.8 }}>
          No session id found in URL (still ok sometimes).
        </p>
      )}

      <p>
        Next step: webhook applies premium to your account (usually within seconds).
      </p>

      <p>
        <a href="/dashboard">Back to dashboard</a>
      </p>
    </div>
  );
}
