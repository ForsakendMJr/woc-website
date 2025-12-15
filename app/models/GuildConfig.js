// models/GuildConfig.js
const mongoose = require("mongoose");

const GuildConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    // Core settings
    prefix: { type: String, default: "!" },

    // Logging
    logs: {
      generalChannelId: { type: String, default: null },
      modChannelId: { type: String, default: null },
      enabled: { type: Boolean, default: true },

      events: {
        messageDelete: { type: Boolean, default: true },
        messageEdit: { type: Boolean, default: true },
        memberJoinLeave: { type: Boolean, default: true },
        moderationActions: { type: Boolean, default: true },
      },
    },

    // Moderation settings (stub, expand later)
    moderation: {
      enabled: { type: Boolean, default: true },
      autoMod: {
        enabled: { type: Boolean, default: false },
        antiInvite: { type: Boolean, default: false },
        antiLink: { type: Boolean, default: false },
      },
    },

    // Dashboard UX / personality hooks
    personality: {
      mood: { type: String, default: "story" }, // story | battle | omen | playful etc
      tagline: { type: String, default: "WoC is watching 👁️" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.GuildConfig || mongoose.model("GuildConfig", GuildConfigSchema);
