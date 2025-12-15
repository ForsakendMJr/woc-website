import mongoose from "mongoose";

const GuildSettingsSchema = new mongoose.Schema(
  {
    guildId: { type: String, unique: true, index: true },

    prefix: { type: String, default: "!" },

    moderation: {
      enabled: { type: Boolean, default: true },
      automod: { type: Boolean, default: false },
      antiLink: { type: Boolean, default: false },
      antiSpam: { type: Boolean, default: true },
    },

    logs: {
      generalChannelId: { type: String, default: "" },
      modlogChannelId: { type: String, default: "" },
      enabled: { type: Boolean, default: true },
    },

    personality: {
      mood: { type: String, default: "story" }, // story | battle | playful | omen | flustered
      sass: { type: Number, default: 35 }, // 0-100
      narration: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.models.GuildSettings ||
  mongoose.model("GuildSettings", GuildSettingsSchema);
