// app/models/GuildSettings.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const LogsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },

    generalChannelId: { type: String, default: "" },
    modlogChannelId: { type: String, default: "" },

    joinChannelId: { type: String, default: "" },
    leaveChannelId: { type: String, default: "" },
    messageChannelId: { type: String, default: "" },
    roleChannelId: { type: String, default: "" },
    nicknameChannelId: { type: String, default: "" },
    commandChannelId: { type: String, default: "" },
    editChannelId: { type: String, default: "" },
  },
  { _id: false }
);

const ModerationSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    automod: { type: Boolean, default: false },
    antiLink: { type: Boolean, default: false },
    antiSpam: { type: Boolean, default: true },
  },
  { _id: false }
);

const PersonalitySchema = new Schema(
  {
    mood: { type: String, default: "story" },
    sass: { type: Number, default: 35 },
    narration: { type: Boolean, default: true },
  },
  { _id: false }
);

// ---- Welcome v2 (matches dashboard + API route) ----

const WelcomeEmbedAuthorSchema = new Schema(
  {
    name: { type: String, default: "{server}" },
    iconUrl: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { _id: false }
);

const WelcomeEmbedFooterSchema = new Schema(
  {
    text: { type: String, default: "Member #{membercount}" },
    iconUrl: { type: String, default: "" },
  },
  { _id: false }
);

const WelcomeEmbedFieldSchema = new Schema(
  {
    name: { type: String, default: "Field title" },
    value: { type: String, default: "Field value" },
    inline: { type: Boolean, default: false },
  },
  { _id: false }
);

const WelcomeEmbedSchema = new Schema(
  {
    color: { type: String, default: "#7c3aed" },
    title: { type: String, default: "Welcome!" },
    url: { type: String, default: "" },
    description: { type: String, default: "Welcome {user} to **{server}**!" },

    author: { type: WelcomeEmbedAuthorSchema, default: () => ({}) },

    thumbnailUrl: { type: String, default: "{avatar}" },
    imageUrl: { type: String, default: "" },

    footer: { type: WelcomeEmbedFooterSchema, default: () => ({}) },

    fields: { type: [WelcomeEmbedFieldSchema], default: [] },
  },
  { _id: false }
);

const WelcomeCardSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },

    title: { type: String, default: "{user.name} just joined the server" },
    subtitle: { type: String, default: "Member #{membercount}" },

    backgroundColor: { type: String, default: "#0b1020" },
    textColor: { type: String, default: "#ffffff" },
    overlayOpacity: { type: Number, default: 0.35 },

    backgroundUrl: { type: String, default: "" },
    showAvatar: { type: Boolean, default: true },
  },
  { _id: false }
);

const WelcomeSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: "" },

    // main plain message (Message + Embed+Text uses this)
    message: { type: String, default: "Welcome {user} to **{server}**! ✨" },

    // autorole
    autoRoleId: { type: String, default: "" },

    // optional DM send
    dmEnabled: { type: Boolean, default: false },

    // canonical (dashboard uses this)
    type: {
      type: String,
      default: "message",
      enum: ["message", "embed", "embed_text", "card"],
    },

    // legacy compat (some docs may still use this)
    mode: {
      type: String,
      default: "message",
      enum: ["message", "embed", "both"],
    },

    // embed builder
    embed: { type: WelcomeEmbedSchema, default: () => ({}) },

    // welcome card
    card: { type: WelcomeCardSchema, default: () => ({}) },
  },
  {
    _id: false,

    // ✅ SAFE: prevents losing new nested fields later (future-proof)
    strict: false,

    // ✅ SAFE: keeps empty nested objects instead of stripping them
    minimize: false,
  }
);


// Ticket Tool style settings (future dashboard + web→bot sync)
const TicketsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },

    categoryId: { type: String, default: "" },
    supportRoleIds: { type: [String], default: [] },

    panels: {
      support: {
        channelId: { type: String, default: "" },
        messageId: { type: String, default: "" },
      },
      bug: {
        channelId: { type: String, default: "" },
        messageId: { type: String, default: "" },
      },
    },

    transcriptChannelId: { type: String, default: "" },

    maxOpenPerUser: { type: Number, default: 1 },
    nameFormatSupport: { type: String, default: "support-{num}" },
    nameFormatBug: { type: String, default: "bug-{num}" },

    nextSupportNumber: { type: Number, default: 1 },
    nextBugNumber: { type: Number, default: 1 },
  },
  { _id: false }
);

const GuildSettingsSchema = new Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      set: (v) => String(v),
    },

    prefix: { type: String, default: "!" },

    moderation: { type: ModerationSchema, default: () => ({}) },
    logs: { type: LogsSchema, default: () => ({}) },

    // ✅ now supports type/mode/dm/embed/card
    welcome: { type: WelcomeSchema, default: () => ({}) },

    modules: { type: Schema.Types.Mixed, default: {} },

    personality: { type: PersonalitySchema, default: () => ({}) },

    tickets: { type: TicketsSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    strict: false,
    minimize: false,
    versionKey: false,
  }
);

// Extra safety: if someone accidentally writes null objects, normalize on save
GuildSettingsSchema.pre("save", function normalize(next) {
  if (!this.logs) this.logs = {};
  if (!this.welcome) this.welcome = {};
  if (!this.moderation) this.moderation = {};
  if (!this.personality) this.personality = {};
  if (!this.modules) this.modules = {};
  if (!this.tickets) this.tickets = {};
  next();
});

export default mongoose.models.GuildSettings ||
  mongoose.model("GuildSettings", GuildSettingsSchema);
