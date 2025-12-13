import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="woc-card p-6">
          <h1 className="text-xl font-semibold mb-2">Dashboard</h1>
          <p className="text-[var(--text-muted)] mb-4">
            You need to log in with Discord to continue.
          </p>
          <Link className="woc-btn-primary inline-flex" href="/signin">
            Sign in with Discord
          </Link>
        </div>
      </div>
    );
  }

  // For now we assume "not invited yet" (later we’ll detect via bot API + guilds)
  const hasInvitedBot = false;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
      <div className="woc-card p-6">
        <h1 className="text-2xl font-semibold">Welcome, {session.discord?.username} 👋</h1>
        <p className="text-[var(--text-muted)]">
          This dashboard will become your control room: voting, rewards, cosmetics, and server setup.
        </p>
      </div>

      {!hasInvitedBot && (
        <div className="woc-card p-6 border border-[var(--border-subtle)]/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">
                Before you continue… invite WoC to a server
              </div>
              <p className="text-[0.85rem] text-[var(--text-muted)] mt-1">
                You can browse, but to earn vote currency and unlock features, WoC must be in at least one server you manage.
              </p>
            </div>

            <a
              className="woc-btn-primary inline-flex justify-center"
              target="_blank"
              rel="noreferrer"
              href="https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&scope=bot%20applications.commands&permissions=0"
            >
              Invite WoC ➕
            </a>
          </div>

          <div className="mt-4 text-xs text-[var(--text-muted)]">
            Tip: once you’ve invited WoC, refresh this page.
          </div>
        </div>
      )}

      <div className="woc-card p-6">
        <h2 className="text-lg font-semibold mb-2">Voting</h2>
        <p className="text-[var(--text-muted)] text-sm">
          Coming next: connect top.gg + discordbotlist voting, track your streak, and claim WoC Coins.
        </p>
      </div>
    </div>
  );
}
