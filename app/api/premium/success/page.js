export default function PremiumSuccessPage({ searchParams }) {
  const sid = searchParams?.session_id || "";
  return (
    <div style={{ padding: 24 }}>
      <h1>Premium purchase started ✅</h1>
      <p>
        Stripe redirected back successfully.
        {sid ? (
          <>
            <br />
            Session: <code>{sid}</code>
          </>
        ) : null}
      </p>
      <p>
        Next step is your webhook marking the user as Premium (we’ll wire that if not done).
      </p>
      <a href="/dashboard">Back to dashboard</a>
    </div>
  );
}
