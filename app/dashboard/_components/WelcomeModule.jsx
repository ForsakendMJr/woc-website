"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const WELCOME_CARD_PNG_ENDPOINT = (gid) =>
  `/api/guilds/${encodeURIComponent(gid)}/welcome-card.png`;

const PREMIUM_TIERS = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];

function normalizeTier(t) {
  const x = String(t || "free").trim().toLowerCase();
  return PREMIUM_TIERS.includes(x) ? x : "free";
}
function tierRank(t) {
  return Math.max(0, PREMIUM_TIERS.indexOf(normalizeTier(t)));
}
function hasTier(currentTier, minTier) {
  return tierRank(currentTier) >= tierRank(minTier);
}

function isSnowflake(id) {
  const s = String(id || "").trim();
  if (!s) return false;
  if (s === "undefined" || s === "null") return false;
  return /^[0-9]{17,20}$/.test(s);
}

function deepClone(obj) {
  try {
    // eslint-disable-next-line no-undef
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {}
  return JSON.parse(JSON.stringify(obj));
}

function clampNum(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function normalizeWelcomeType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return "message";
  if (t === "embed+text") return "embed_text";
  if (t === "embed_text") return "embed_text";
  if (t === "both") return "embed_text";
  if (t === "message") return "message";
  if (t === "embed") return "embed";
  if (t === "card") return "card";
  return "message";
}

function ensureWelcomeDefaults(welcome) {
  const w = welcome && typeof welcome === "object" ? deepClone(welcome) : {};

  if (typeof w.enabled !== "boolean") w.enabled = false;
  w.type = normalizeWelcomeType(w.type);

  if (typeof w.channelId !== "string") w.channelId = "";
  if (typeof w.message !== "string") w.message = "Welcome {user} to **{server}**! ✨";
  if (typeof w.autoRoleId !== "string") w.autoRoleId = "";
  if (typeof w.dmEnabled !== "boolean") w.dmEnabled = false;

  // Embed config
  w.embed ||= {};
  if (typeof w.embed.title !== "string") w.embed.title = "Welcome!";
  if (typeof w.embed.url !== "string") w.embed.url = "";
  if (typeof w.embed.description !== "string")
    w.embed.description = "Welcome {user} to **{server}**!";
  if (typeof w.embed.color !== "string") w.embed.color = "#7c3aed";
  if (typeof w.embed.thumbnailUrl !== "string") w.embed.thumbnailUrl = "{avatar}";
  if (typeof w.embed.imageUrl !== "string") w.embed.imageUrl = "";
  if (typeof w.embed.author !== "object" || !w.embed.author) w.embed.author = {};
  if (typeof w.embed.author.name !== "string") w.embed.author.name = "{server}";
  if (typeof w.embed.author.iconUrl !== "string") w.embed.author.iconUrl = "";
  if (typeof w.embed.author.url !== "string") w.embed.author.url = "";
  if (typeof w.embed.footer !== "object" || !w.embed.footer) w.embed.footer = {};
  if (typeof w.embed.footer.text !== "string") w.embed.footer.text = "Member #{membercount}";
  if (typeof w.embed.footer.iconUrl !== "string") w.embed.footer.iconUrl = "";
  if (!Array.isArray(w.embed.fields)) w.embed.fields = [];

  // Card config
  w.card ||= {};
  if (typeof w.card.enabled !== "boolean") w.card.enabled = false;
  if (typeof w.card.title !== "string") w.card.title = "{user.name} just joined the server";
  if (typeof w.card.subtitle !== "string") w.card.subtitle = "Member #{membercount}";
  if (typeof w.card.backgroundColor !== "string") w.card.backgroundColor = "#0b1020";
  if (typeof w.card.textColor !== "string") w.card.textColor = "#ffffff";
  if (typeof w.card.overlayOpacity !== "number") w.card.overlayOpacity = 0.35;
  if (typeof w.card.backgroundUrl !== "string") w.card.backgroundUrl = "";
  if (typeof w.card.showAvatar !== "boolean") w.card.showAvatar = true;

  if (w.type === "card") w.card.enabled = true;

  return w;
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function ChannelPicker({
  channels,
  value,
  onChange,
  disabled,
  placeholder = "Select a channel",
  allowNone = true,
  noneLabel = "None",
}) {
  const list = Array.isArray(channels) ? channels : [];
  return (
    <select
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        `
          mt-3 w-full px-3 py-2 rounded-2xl
          border border-[var(--border-subtle)]/70
          bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
          text-[var(--text-main)]
          outline-none
        `,
        disabled ? "opacity-60 cursor-not-allowed" : ""
      )}
    >
      {allowNone ? <option value="">{noneLabel}</option> : <option value="">{placeholder}</option>}
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          #{c.name}
          {c.typeLabel ? ` (${c.typeLabel})` : ""}
          {c.parentName ? ` in ${c.parentName}` : ""}
        </option>
      ))}
    </select>
  );
}

function buildWelcomeCardPreviewUrl({
  guildId,
  serverName,
  serverIconUrl,
  username,
  membercount,
  avatarUrl,
  title,
  subtitle,
  backgroundColor,
  textColor,
  overlayOpacity,
  showAvatar,
  backgroundUrl,
  bust,
}) {
  if (!isSnowflake(guildId)) return "";
  const params = new URLSearchParams();
  if (serverName) params.set("serverName", serverName);
  if (serverIconUrl) params.set("serverIconUrl", serverIconUrl);
  if (username) params.set("username", username);
  if (membercount) params.set("membercount", String(membercount));
  if (avatarUrl) params.set("avatarUrl", avatarUrl);

  if (title) params.set("title", title);
  if (subtitle) params.set("subtitle", subtitle);

  if (backgroundColor) params.set("backgroundColor", backgroundColor);
  if (textColor) params.set("textColor", textColor);
  if (typeof overlayOpacity === "number") params.set("overlayOpacity", String(overlayOpacity));
  params.set("showAvatar", showAvatar ? "true" : "false");
  if (backgroundUrl) params.set("backgroundUrl", backgroundUrl);

  params.set("_", String(bust || Date.now()));
  return `${WELCOME_CARD_PNG_ENDPOINT(guildId)}?${params.toString()}`;
}

export default function WelcomeModule({
  guildId,
  settings,
  onChange,
  channels,

  // Optional premium gating inputs
  premiumActive = false,
  premiumTier = "free",
  freeBackgrounds = [],
  premiumBackgrounds = [],
}) {
  const gid = String(guildId || "").trim();
  const guildOk = isSnowflake(gid);

  const welcome = useMemo(() => ensureWelcomeDefaults(settings?.welcome), [settings]);

  const [bgNotice, setBgNotice] = useState("");
  const [previewBust, setPreviewBust] = useState(Date.now());
  const [previewError, setPreviewError] = useState("");
  const [metaStatus, setMetaStatus] = useState("");

  const type = normalizeWelcomeType(welcome?.type);

  const textChannels = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    return list.filter((c) => {
      const t = String(c?.type || "").toLowerCase();
      const label = String(c?.typeLabel || "").toLowerCase();
      return (
        t.includes("text") ||
        label.includes("text") ||
        t.includes("announcement") ||
        label.includes("announce")
      );
    });
  }, [channels]);

  function setWelcome(patch) {
    const next = deepClone(settings || {});
    next.welcome = ensureWelcomeDefaults({ ...(next.welcome || {}), ...patch });
    onChange(next);
  }

  function setEmbed(patch) {
    const next = deepClone(settings || {});
    const w = ensureWelcomeDefaults(next.welcome);
    w.embed = { ...(w.embed || {}), ...patch };
    next.welcome = w;
    onChange(next);
  }

  function setCard(patch) {
    const next = deepClone(settings || {});
    const w = ensureWelcomeDefaults(next.welcome);
    w.card = { ...(w.card || {}), ...patch };
    next.welcome = w;
    onChange(next);
  }

  const previewUrl = useMemo(() => {
    if (type !== "card") return "";
    if (!guildOk) return "";

    const card = ensureWelcomeDefaults(welcome).card;

    // Premium background gating (if provided)
    const rawBg = String(card?.backgroundUrl || "");
    const premOpt = (premiumBackgrounds || []).find((o) => o.value === rawBg);

    let bgForPreview = rawBg;
    if (premOpt) {
      const required = normalizeTier(premOpt.tier || "supporter");
      const allowed = premiumActive && hasTier(premiumTier, required);
      if (!allowed) bgForPreview = "";
    }

    return buildWelcomeCardPreviewUrl({
      guildId: gid,
      serverName: settings?.guildName || "Server",
      serverIconUrl: settings?.guildIconUrl || "",
      username: settings?.previewUserName || "New Member",
      membercount: settings?.previewMemberCount || "123",
      avatarUrl: settings?.previewAvatarUrl || "",
      title: card?.title || "{user.name} just joined the server",
      subtitle: card?.subtitle || "Member #{membercount}",
      backgroundColor: card?.backgroundColor || "#0b1020",
      textColor: card?.textColor || "#ffffff",
      overlayOpacity: clampNum(card?.overlayOpacity ?? 0.35, 0, 0.85),
      showAvatar: card?.showAvatar !== false,
      backgroundUrl: bgForPreview,
      bust: previewBust,
    });
  }, [
    type,
    gid,
    guildOk,
    welcome,
    previewBust,
    premiumActive,
    premiumTier,
    premiumBackgrounds,
    settings,
  ]);

  // Meta check (background loading status)
  useEffect(() => {
    if (type !== "card") return;
    if (!guildOk) return;
    if (!previewUrl) return;

    const card = ensureWelcomeDefaults(welcome).card;
    const bg = String(card?.backgroundUrl || "");
    if (!bg) {
      setMetaStatus("");
      return;
    }

    const ac = new AbortController();

    (async () => {
      try {
        // ✅ IMPORTANT: previewUrl is relative, so give URL a base
        const u = new URL(previewUrl, window.location.origin);
        u.searchParams.set("meta", "1");

        const res = await fetch(u.toString(), { cache: "no-store", signal: ac.signal });
        const data = await res.json().catch(() => null);
        const st = data?.background?.status || "";
        setMetaStatus(st && st !== "ok" ? st : "");
      } catch {
        setMetaStatus("");
      }
    })();

    return () => ac.abort();
  }, [type, guildOk, welcome, previewUrl]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Welcome</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Message / Embed / Embed+Text / Card. Everything lives in settings.welcome.*
          </div>
        </div>

        {!guildOk ? (
          <div className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
            Pick a server first.
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="woc-card p-4">
          <div className="font-semibold text-sm">Enable welcome</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Master switch for welcome payloads.
          </div>
          <input
            type="checkbox"
            className="mt-3"
            disabled={!guildOk}
            checked={!!welcome?.enabled}
            onChange={(e) => setWelcome({ enabled: e.target.checked })}
          />
        </label>

        <div className="woc-card p-4">
          <div className="font-semibold text-sm">Welcome channel</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Where the welcome message is posted.
          </div>

          <ChannelPicker
            channels={textChannels}
            value={welcome?.channelId || ""}
            disabled={!guildOk}
            onChange={(val) => setWelcome({ channelId: val })}
            allowNone={false}
            placeholder="Select a channel"
          />
        </div>

        {/* Type selector */}
        <div className="woc-card p-4 sm:col-span-2">
          <div className="font-semibold text-sm mb-2">Message type</div>

          <div className="flex flex-wrap gap-2">
            {[
              ["message", "Message"],
              ["embed", "Embed"],
              ["embed_text", "Embed + Text"],
              ["card", "Card"],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                disabled={!guildOk}
                onClick={() => {
                  const next = ensureWelcomeDefaults({
                    ...welcome,
                    type: val,
                    card: { ...(welcome?.card || {}), enabled: val === "card" },
                  });
                  const s2 = deepClone(settings || {});
                  s2.welcome = next;
                  onChange(s2);

                  setPreviewError("");
                  setMetaStatus("");
                  setBgNotice("");
                  setPreviewBust(Date.now());
                }}
                className={cx(
                  "px-3 py-2 rounded-full border text-xs",
                  "border-[var(--border-subtle)]/70",
                  !guildOk ? "opacity-60 cursor-not-allowed" : "",
                  type === val
                    ? "bg-[color-mix(in_oklab,var(--accent-soft)_55%,transparent)]"
                    : "bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--bg-card)_85%,transparent)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
            Tokens: {"{user}"} {"{mention}"} {"{username}"} {"{user.name}"} {"{tag}"} {"{server}"}{" "}
            {"{server.name}"} {"{membercount}"} {"{server.member_count}"} {"{id}"} {"{avatar}"}
          </div>
        </div>

        {/* Optional DM */}
        <label className="woc-card p-4 sm:col-span-2 flex items-start justify-between gap-3 cursor-pointer">
          <div>
            <div className="font-semibold text-sm">Send welcome in DM</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Sends the same welcome payload to the user’s DMs.
            </div>
          </div>
          <input
            type="checkbox"
            className="mt-1"
            disabled={!guildOk}
            checked={!!welcome?.dmEnabled}
            onChange={(e) => setWelcome({ dmEnabled: e.target.checked })}
          />
        </label>

        {/* Text message editor */}
        {["message", "embed_text"].includes(type) ? (
          <label className="woc-card p-4 sm:col-span-2">
            <div className="font-semibold text-sm">Welcome message</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Used for <b>Message</b> and <b>Embed + Text</b>.
            </div>
            <textarea
              value={welcome?.message || ""}
              disabled={!guildOk}
              onChange={(e) => setWelcome({ message: e.target.value })}
              className="
                mt-3 w-full px-3 py-2 rounded-2xl min-h-[110px]
                border border-[var(--border-subtle)]/70
                bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
                text-[var(--text-main)]
                outline-none
              "
              placeholder="Welcome {user} to {server}! ✨"
            />
          </label>
        ) : null}

        {/* EMBED BUILDER */}
        {["embed", "embed_text"].includes(type) ? (
          <div className="woc-card p-5 sm:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">Embed builder</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Builds <code>settings.welcome.embed</code>.
                </div>
              </div>
              <div className="text-[0.72rem] text-[var(--text-muted)]">
                Tip: thumbnail <b>{"{avatar}"}</b>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              <label className="sm:col-span-2">
                <div className="text-xs mb-1 text-[var(--text-muted)]">Title</div>
                <input
                  value={welcome?.embed?.title || ""}
                  disabled={!guildOk}
                  onChange={(e) => setEmbed({ title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="Welcome!"
                />
              </label>

              <label className="sm:col-span-2">
                <div className="text-xs mb-1 text-[var(--text-muted)]">Description</div>
                <textarea
                  value={welcome?.embed?.description || ""}
                  disabled={!guildOk}
                  onChange={(e) => setEmbed({ description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl min-h-[90px] border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="Welcome {user} to **{server}**!"
                />
              </label>

              <label>
                <div className="text-xs mb-1 text-[var(--text-muted)]">Color (hex)</div>
                <input
                  value={welcome?.embed?.color || ""}
                  disabled={!guildOk}
                  onChange={(e) => setEmbed({ color: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="#7c3aed"
                />
              </label>

              <label>
                <div className="text-xs mb-1 text-[var(--text-muted)]">URL (optional)</div>
                <input
                  value={welcome?.embed?.url || ""}
                  disabled={!guildOk}
                  onChange={(e) => setEmbed({ url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="https://..."
                />
              </label>

              <label>
                <div className="text-xs mb-1 text-[var(--text-muted)]">Thumbnail URL</div>
                <input
                  value={welcome?.embed?.thumbnailUrl || ""}
                  disabled={!guildOk}
                  onChange={(e) => setEmbed({ thumbnailUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="{avatar}"
                />
              </label>

              <label>
                <div className="text-xs mb-1 text-[var(--text-muted)]">Image URL (optional)</div>
                <input
                  value={welcome?.embed?.imageUrl || ""}
                  disabled={!guildOk}
                  onChange={(e) => setEmbed({ imageUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="https://..."
                />
              </label>

              <div className="sm:col-span-2 woc-card p-4">
                <div className="font-semibold text-sm">Author</div>
                <div className="grid gap-3 sm:grid-cols-3 mt-3">
                  <label>
                    <div className="text-xs mb-1 text-[var(--text-muted)]">Name</div>
                    <input
                      value={welcome?.embed?.author?.name || ""}
                      disabled={!guildOk}
                      onChange={(e) =>
                        setEmbed({ author: { ...(welcome?.embed?.author || {}), name: e.target.value } })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                      placeholder="{server}"
                    />
                  </label>
                  <label>
                    <div className="text-xs mb-1 text-[var(--text-muted)]">Icon URL</div>
                    <input
                      value={welcome?.embed?.author?.iconUrl || ""}
                      disabled={!guildOk}
                      onChange={(e) =>
                        setEmbed({
                          author: { ...(welcome?.embed?.author || {}), iconUrl: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    <div className="text-xs mb-1 text-[var(--text-muted)]">URL</div>
                    <input
                      value={welcome?.embed?.author?.url || ""}
                      disabled={!guildOk}
                      onChange={(e) =>
                        setEmbed({ author: { ...(welcome?.embed?.author || {}), url: e.target.value } })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                      placeholder="https://..."
                    />
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2 woc-card p-4">
                <div className="font-semibold text-sm">Footer</div>
                <div className="grid gap-3 sm:grid-cols-2 mt-3">
                  <label>
                    <div className="text-xs mb-1 text-[var(--text-muted)]">Text</div>
                    <input
                      value={welcome?.embed?.footer?.text || ""}
                      disabled={!guildOk}
                      onChange={(e) =>
                        setEmbed({ footer: { ...(welcome?.embed?.footer || {}), text: e.target.value } })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                      placeholder="Member #{membercount}"
                    />
                  </label>
                  <label>
                    <div className="text-xs mb-1 text-[var(--text-muted)]">Icon URL</div>
                    <input
                      value={welcome?.embed?.footer?.iconUrl || ""}
                      disabled={!guildOk}
                      onChange={(e) =>
                        setEmbed({
                          footer: { ...(welcome?.embed?.footer || {}), iconUrl: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                      placeholder="https://..."
                    />
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2 woc-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm">Fields</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Up to 25 fields.</div>
                  </div>
                  <button
                    type="button"
                    disabled={!guildOk || (welcome?.embed?.fields || []).length >= 25}
                    className={cx("woc-btn-ghost text-xs", !guildOk ? "opacity-60 cursor-not-allowed" : "")}
                    onClick={() => {
                      const nextFields = [...(welcome?.embed?.fields || [])];
                      if (nextFields.length >= 25) return;
                      nextFields.push({ name: "Field title", value: "Field value", inline: false });
                      setEmbed({ fields: nextFields });
                    }}
                  >
                    + Add field
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {(welcome?.embed?.fields || []).map((f, idx) => (
                    <div key={idx} className="woc-card p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-[var(--text-muted)]">Field #{idx + 1}</div>
                        <button
                          type="button"
                          disabled={!guildOk}
                          className={cx("woc-btn-ghost text-xs", !guildOk ? "opacity-60 cursor-not-allowed" : "")}
                          onClick={() => {
                            const nextFields = [...(welcome?.embed?.fields || [])];
                            nextFields.splice(idx, 1);
                            setEmbed({ fields: nextFields });
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 mt-3">
                        <label>
                          <div className="text-xs mb-1 text-[var(--text-muted)]">Name</div>
                          <input
                            value={f?.name || ""}
                            disabled={!guildOk}
                            onChange={(e) => {
                              const nextFields = [...(welcome?.embed?.fields || [])];
                              nextFields[idx] = { ...(nextFields[idx] || {}), name: e.target.value };
                              setEmbed({ fields: nextFields });
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                          />
                        </label>

                        <label className="flex items-end justify-between gap-3">
                          <span className="text-xs text-[var(--text-muted)]">Inline</span>
                          <input
                            type="checkbox"
                            disabled={!guildOk}
                            checked={!!f?.inline}
                            onChange={(e) => {
                              const nextFields = [...(welcome?.embed?.fields || [])];
                              nextFields[idx] = { ...(nextFields[idx] || {}), inline: e.target.checked };
                              setEmbed({ fields: nextFields });
                            }}
                          />
                        </label>

                        <label className="sm:col-span-2">
                          <div className="text-xs mb-1 text-[var(--text-muted)]">Value</div>
                          <textarea
                            value={f?.value || ""}
                            disabled={!guildOk}
                            onChange={(e) => {
                              const nextFields = [...(welcome?.embed?.fields || [])];
                              nextFields[idx] = { ...(nextFields[idx] || {}), value: e.target.value };
                              setEmbed({ fields: nextFields });
                            }}
                            className="w-full px-3 py-2 rounded-xl min-h-[80px] border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  {!welcome?.embed?.fields?.length ? (
                    <div className="text-xs text-[var(--text-muted)]">No fields yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* CARD BUILDER */}
        {type === "card" ? (
          <div className="woc-card p-5 sm:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">Welcome card</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  PNG preview powered by: <code>/api/guilds/[guildId]/welcome-card.png</code>
                </div>
              </div>
              <button
                type="button"
                disabled={!guildOk}
                className={cx("woc-btn-ghost text-xs", !guildOk ? "opacity-60 cursor-not-allowed" : "")}
                onClick={() => {
                  setPreviewBust(Date.now());
                  setPreviewError("");
                }}
              >
                Refresh preview 🔄
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              <label className="sm:col-span-2">
                <div className="text-xs mb-1 text-[var(--text-muted)]">Title</div>
                <input
                  value={welcome?.card?.title || ""}
                  disabled={!guildOk}
                  onChange={(e) => {
                    setCard({ title: e.target.value });
                    setPreviewBust(Date.now());
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                />
              </label>

              <label className="sm:col-span-2">
                <div className="text-xs mb-1 text-[var(--text-muted)]">Subtitle</div>
                <input
                  value={welcome?.card?.subtitle || ""}
                  disabled={!guildOk}
                  onChange={(e) => {
                    setCard({ subtitle: e.target.value });
                    setPreviewBust(Date.now());
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                />
              </label>

              <label>
                <div className="text-xs mb-1 text-[var(--text-muted)]">Background color</div>
                <input
                  value={welcome?.card?.backgroundColor || ""}
                  disabled={!guildOk}
                  onChange={(e) => {
                    setCard({ backgroundColor: e.target.value });
                    setPreviewBust(Date.now());
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="#0b1020"
                />
              </label>

              <label>
                <div className="text-xs mb-1 text-[var(--text-muted)]">Text color</div>
                <input
                  value={welcome?.card?.textColor || ""}
                  disabled={!guildOk}
                  onChange={(e) => {
                    setCard({ textColor: e.target.value });
                    setPreviewBust(Date.now());
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                  placeholder="#ffffff"
                />
              </label>

              <label>
                <div className="text-xs mb-1 text-[var(--text-muted)]">Overlay opacity</div>
                <input
                  type="number"
                  min="0"
                  max="0.85"
                  step="0.05"
                  value={Number(welcome?.card?.overlayOpacity ?? 0.35)}
                  disabled={!guildOk}
                  onChange={(e) => {
                    setCard({ overlayOpacity: clampNum(e.target.value, 0, 0.85) });
                    setPreviewBust(Date.now());
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                />
              </label>

              <label className="flex items-center justify-between gap-3 woc-card p-4">
                <div>
                  <div className="font-semibold text-sm">Show avatar</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Display user avatar bubble.</div>
                </div>
                <input
                  type="checkbox"
                  disabled={!guildOk}
                  checked={welcome?.card?.showAvatar !== false}
                  onChange={(e) => {
                    setCard({ showAvatar: e.target.checked });
                    setPreviewBust(Date.now());
                  }}
                />
              </label>

              <label className="sm:col-span-2">
                <div className="text-xs mb-1 text-[var(--text-muted)]">Background theme (built-in)</div>

                <select
                  value={welcome?.card?.backgroundUrl || ""}
                  disabled={!guildOk}
                  onChange={(e) => {
                    const nextVal = e.target.value;

                    const premOpt = (premiumBackgrounds || []).find((o) => o.value === nextVal);
                    if (premOpt) {
                      const required = normalizeTier(premOpt.tier || "supporter");
                      const allowed = premiumActive && hasTier(premiumTier, required);

                      if (!allowed) {
                        setBgNotice(
                          `Locked: "${premOpt.label}" requires ${required.replaceAll("_", " ")} Premium.`
                        );
                        return;
                      }
                    }

                    setBgNotice("");
                    setCard({ backgroundUrl: nextVal });
                    setPreviewBust(Date.now());
                    setPreviewError("");
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)]/70 bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)] outline-none"
                >
                  <optgroup label="Free backgrounds">
                    {(freeBackgrounds || []).length ? null : (
                      <option value="">None (use gradient only)</option>
                    )}
                    {(freeBackgrounds || []).map((opt) => (
                      <option key={opt.value || "none"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>

                  <optgroup label="Premium packs">
                    {(premiumBackgrounds || []).map((opt) => {
                      const required = normalizeTier(opt.tier || "supporter");
                      const locked = !(premiumActive && hasTier(premiumTier, required));
                      return (
                        <option key={opt.value} value={opt.value} disabled={locked}>
                          {locked
                            ? `🔒 ${opt.label} (requires ${required.replaceAll("_", " ")})`
                            : opt.label}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>

                {!premiumActive ? (
                  <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                    Premium packs are locked.{" "}
                    <Link className="underline" href="/premium">
                      Unlock backgrounds ✨
                    </Link>
                  </div>
                ) : (
                  <div className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
                    Tip: Put images in <b>/public/welcome-backgrounds/</b> so they always work.
                  </div>
                )}

                {bgNotice ? (
                  <div className="mt-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    {bgNotice}
                  </div>
                ) : null}
              </label>

              <div className="sm:col-span-2">
                <div className="text-xs text-[var(--text-muted)] mb-2">Preview</div>

                {!previewUrl ? (
                  <div className="woc-card p-4 text-xs text-[var(--text-muted)]">
                    Preview unavailable (missing guildId).
                  </div>
                ) : (
                  <div className="woc-card p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Welcome card preview"
                      className="w-full rounded-2xl border border-[var(--border-subtle)]/70"
                      onError={() =>
                        setPreviewError("Preview failed to load. (Route error or blocked image.)")
                      }
                      onLoad={() => setPreviewError("")}
                    />

                    {metaStatus ? (
                      <div className="mt-3 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                        Background status: <b>{metaStatus}</b>
                        {metaStatus === "blocked_html" ? (
                          <div className="mt-1 text-[0.78rem] text-[var(--text-muted)]">
                            The background URL returned HTML (hotlink protection). Use local{" "}
                            <b>/public/welcome-backgrounds/</b> paths.
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {previewError ? (
                      <div className="mt-3 text-xs text-rose-200/90 bg-rose-500/10 border border-rose-400/30 rounded-xl p-3">
                        {previewError}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* AUTOROLE */}
        <div className="woc-card p-4 sm:col-span-2">
          <div className="font-semibold text-sm">Auto-role (optional)</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Role ID to auto-assign when someone joins.
          </div>
          <input
            value={welcome?.autoRoleId || ""}
            disabled={!guildOk}
            onChange={(e) => setWelcome({ autoRoleId: e.target.value })}
            className="
              mt-3 w-full px-3 py-2 rounded-2xl
              border border-[var(--border-subtle)]/70
              bg-[color-mix(in_oklab,var(--bg-card)_70%,transparent)]
              text-[var(--text-main)]
              outline-none
            "
            placeholder="123456789012345678"
          />
        </div>
      </div>
    </div>
  );
}
