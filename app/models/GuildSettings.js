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

const WelcomeSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: "" },
    message: { type: String, default: "Welcome {user} to **{server}**! ✨" },
    autoRoleId: { type: String, default: "" },
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

// Ticket Tool style settings (future dashboard + web→bot sync)
const TicketsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },

    // Where tickets get created / handled
    categoryId: { type: String, default: "" },
    supportRoleIds: { type: [String], default: [] },

    // Panel channels for different ticket types
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

    // Transcripts/logging
    transcriptChannelId: { type: String, default: "" },

    // Limits + naming
    maxOpenPerUser: { type: Number, default: 1 },
    nameFormatSupport: { type: String, default: "support-{num}" },
    nameFormatBug: { type: String, default: "bug-{num}" },

    // Counters
    nextSupportNumber: { type: Number, default: 1 },
    nextBugNumber: { type: Number, default: 1 },
  },
  { _id: false }
);

const GuildSettingsSchema = new Schema(
  {
    // Keep guildId ALWAYS as string
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

    welcome: { type: WelcomeSchema, default: () => ({}) },

    // Feature flags (category + sub-feature toggles)
    // Mixed is fine here because you want dynamic categories/subkeys.
    modules: { type: Schema.Types.Mixed, default: {} },

    personality: { type: PersonalitySchema, default: () => ({}) },

    // ✅ New section (safe to add; old docs will just not have it)
    tickets: { type: TicketsSchema, default: () => ({}) },
  },
  {
    timestamps: true,

    // ✅ Important for “dashboard evolves over time”
    strict: false,

    // ✅ Don’t strip empty objects (helps nested settings + future expansion)
    minimize: false,

    // Optional: keeps docs cleaner
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
