"use client";

import { useMemo } from "react";

/**
 * WelcomeModule
 * - Restores Message / Embed / Embed+Text / Card builders
 * - Card preview uses: /api/guilds/[guildId]/welcome-card.png
 *
 * Expected props:
 * - guildId: string
 * - settings: object (your guild settings object)
 * - onChange: (nextSettings) => void  (you persist this into your settings state)
 * - channels: array of { id, name } or { id, name, type } (optional)
 */
export default function WelcomeModule({
  guildId,
  settings,
  onChange,
  channels = [],
}) {
  const s = settings || {};

  // --- Module enable + channel (stored under settings.modules.welcome) ---
  const welcome = s.modules?.welcome || s.welcome || {};
  const welcomeEnabled = !!welcome.enabled;
  const welcomeChannelId = welcome.channelId || "";

  // --- Message type (stored under settings.modules.welcome.messageType) ---
  const messageType = String(welcome.messageType || "message"); // message | embed | embed_text | card

  // --- Plain message (stored under settings.modules.welcome.message) ---
  const welcomeMessage = String(
    welcome.message || "Welcome {user} to **{server}**! ✨"
  );

  // --- Embed builder (stored under settings.modules.welcome.embed) ---
  const embed = welcome.embed || {};
  const embedTitle = String(embed.title || "Welcome!");
  const embedDescription = String(
    embed.description ||
      "Hey {user}, welcome to **{server}**!\nYou are member #{membercount}."
  );
  const embedColor = String(embed.color || "#8b5cf6");
  const embedFooter = String(embed.footer || "WoC • Welcome");

  // --- Welcome card builder (stored under settings.welcomeCard) ---
  const welcomeCard = s.welcomeCard || {};
  const cardBackgroundUrl = String(welcomeCard.backgroundUrl || "");
  const cardTitle = String(welcomeCard.title || "Welcome!");
  const cardSubtitle = String(
    welcomeCard.subtitle || "{user.name} joined {server.name} • #{membercount}"
  );
  const cardBackgroundColor = String(welcomeCard.backgroundColor || "#0b1020");
  const cardTextColor = String(welcomeCard.textColor || "#ffffff");
  const cardOverlayOpacity =
    typeof welcomeCard.overlayOpacity === "number"
      ? welcomeCard.overlayOpacity
      : 0.35;
  const cardShowAvatar = welcomeCard.showAvatar !== false;

  function update(path, value) {
    // tiny immutable update helper
    const next = structuredCloneSafe(s);

    // create paths safely
    if (!next.modules) next.modules = {};
    if (!next.modules.welcome) next.modules.welcome = {};
    if (!next.welcomeCard) next.welcomeCard = {};

    // route updates
    if (path.startsWith("modules.welcome.")) {
      const key = path.replace("modules.welcome.", "");
      next.modules.welcome[key] = value;
    } else if (path.startsWith("modules.welcome.embed.")) {
      const key = path.replace("modules.welcome.embed.", "");
      if (!next.modules.welcome.embed) next.modules.welcome.embed = {};
      next.modules.welcome.embed[key] = value;
    } else if (path.startsWith("welcomeCard.")) {
      const key = path.replace("welcomeCard.", "");
      next.welcomeCard[key] = value;
    }

    onChange?.(next);
  }

  const channelOptions = useMemo(() => {
    return Array.isArray(channels) ? channels : [];
  }, [channels]);

  const tokensHelp =
    "Tokens: {user} {mention} {username} {user.name} {tag} {server} {server.name} {membercount} {server.member_count} {id} {avatar}";

  const previewUrl = useMemo(() => {
    const gid = String(guildId || "").trim();
    if (!gid) return "";

    const params = new URLSearchParams({
      backgroundUrl: cardBackgroundUrl,
      title: cardTitle,
      subtitle: cardSubtitle,
      backgroundColor: cardBackgroundColor,
      textColor: cardTextColor,
      overlayOpacity: String(cardOverlayOpacity),
      showAvatar: String(cardShowAvatar),

      // preview placeholders
      username: "Forsakend",
      serverName: "WoC Hub",
      membercount: "1337",

      // optional preview imagery (leave blank if you don't have)
      avatarUrl: "",
      serverIconUrl: "",
    });

    return `/api/guilds/${encodeURIComponent(gid)}/welcome-card.png?${params.toString()}`;
  }, [
    guildId,
    cardBackgroundUrl,
    cardTitle,
    cardSubtitle,
    cardBackgroundColor,
    cardTextColor,
    cardOverlayOpacity,
    cardShowAvatar,
  ]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-white font-semibold text-lg">Welcome</div>
          <div className="text-white/60 text-sm">
            Welcome channel + message template + embed builder + welcome card.
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm text-white/80">
          <span className="text-white/70">Enable</span>
          <input
            type="checkbox"
            checked={welcomeEnabled}
            onChange={(e) => update("modules.welcome.enabled", e.target.checked)}
            className="h-4 w-4 accent-violet-400"
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-white/80 text-sm font-medium">Welcome channel</div>
          <div className="mt-2">
            <select
              value={welcomeChannelId}
              onChange={(e) => update("modules.welcome.channelId", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">Select a channel…</option>
              {channelOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 text-xs text-white/50">{tokensHelp}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-white/80 text-sm font-medium">Message type</div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill
              active={messageType === "message"}
              onClick={() => update("modules.welcome.messageType", "message")}
            >
              Message
            </Pill>
            <Pill
              active={messageType === "embed"}
              onClick={() => update("modules.welcome.messageType", "embed")}
            >
              Embed
            </Pill>
            <Pill
              active={messageType === "embed_text"}
              onClick={() => update("modules.welcome.messageType", "embed_text")}
            >
              Embed + Text
            </Pill>
            <Pill
              active={messageType === "card"}
              onClick={() => update("modules.welcome.messageType", "card")}
            >
              Card
            </Pill>
          </div>

          <div className="mt-3 text-xs text-white/50">{tokensHelp}</div>
        </div>
      </div>

      {/* Builders */}
      <div className="mt-4 grid grid-cols-1 gap-4">
        {(messageType === "message" || messageType === "embed_text") && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-white/80 text-sm font-medium">Welcome message</div>
            <textarea
              value={welcomeMessage}
              onChange={(e) => update("modules.welcome.message", e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            />
            <div className="mt-2 text-xs text-white/50">
              Tip: Markdown is fine. Tokens will be replaced when sending.
            </div>
          </div>
        )}

        {(messageType === "embed" || messageType === "embed_text") && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-white/80 text-sm font-medium">Embed builder</div>
                <div className="text-xs text-white/50">
                  Simple embed settings (you can expand later).
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Color</span>
                <input
                  value={embedColor}
                  onChange={(e) => update("modules.welcome.embed.color", e.target.value)}
                  className="w-28 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">Title</div>
                <input
                  value={embedTitle}
                  onChange={(e) => update("modules.welcome.embed.title", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Footer</div>
                <input
                  value={embedFooter}
                  onChange={(e) => update("modules.welcome.embed.footer", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60">Description</div>
              <textarea
                value={embedDescription}
                onChange={(e) =>
                  update("modules.welcome.embed.description", e.target.value)
                }
                rows={4}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          </div>
        )}

        {messageType === "card" && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-white/80 text-sm font-medium">Welcome card</div>
                <div className="text-xs text-white/50">
                  Sends a visual-style card (PNG preview powered by your API route).
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-white/80">
                <span className="text-white/70">Show avatar</span>
                <input
                  type="checkbox"
                  checked={cardShowAvatar}
                  onChange={(e) =>
                    update("welcomeCard.showAvatar", e.target.checked)
                  }
                  className="h-4 w-4 accent-violet-400"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">Background image URL (optional)</div>
                <input
                  value={cardBackgroundUrl}
                  onChange={(e) => update("welcomeCard.backgroundUrl", e.target.value)}
                  placeholder="https://... or /welcome-backgrounds/your.png"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                <div className="mt-2 text-xs text-white/50">
                  Tip: Put images in <span className="text-white/70">/public/welcome-backgrounds/</span> and use{" "}
                  <span className="text-white/70">/welcome-backgrounds/name.png</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-white/60">Background color</div>
                  <input
                    value={cardBackgroundColor}
                    onChange={(e) =>
                      update("welcomeCard.backgroundColor", e.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60">Text color</div>
                  <input
                    value={cardTextColor}
                    onChange={(e) => update("welcomeCard.textColor", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-white/60">
                    Overlay opacity <span className="text-white/40">(0 to 0.85)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.85"
                    step="0.01"
                    value={Number(cardOverlayOpacity)}
                    onChange={(e) =>
                      update("welcomeCard.overlayOpacity", Number(e.target.value))
                    }
                    className="mt-2 w-full"
                  />
                  <div className="mt-1 text-xs text-white/50">
                    Current: {Number(cardOverlayOpacity).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-white/60">Title</div>
                <input
                  value={cardTitle}
                  onChange={(e) => update("welcomeCard.title", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Subtitle</div>
                <input
                  value={cardSubtitle}
                  onChange={(e) => update("welcomeCard.subtitle", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs text-white/60">Live preview</div>
                <div className="text-[11px] text-white/40">
                  {guildId ? `/api/guilds/${guildId}/welcome-card.png` : "Select a guild"}
                </div>
              </div>

              {guildId ? (
                <img
                  alt="Welcome card preview"
                  src={previewUrl}
                  className="w-full rounded-xl border border-white/10"
                />
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
                  Select a server to preview the welcome card.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm transition border",
        active
          ? "border-violet-400/40 bg-violet-500/10 text-white"
          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function structuredCloneSafe(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj || {}));
  }
}
