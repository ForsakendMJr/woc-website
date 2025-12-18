// app/models/GuildSettings.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const GuildSettingsSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    prefix: { type: String, default: "!" },

    moderation: {
      enabled: { type: Boolean, default: true },
      automod: { type: Boolean, default: false },
      antiLink: { type: Boolean, default: false },
      antiSpam: { type: Boolean, default: true },
    },

    logs: {
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

    welcome: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: "" },
      message: { type: String, default: "Welcome {user} to **{server}**! ✨" },
      autoRoleId: { type: String, default: "" },
    },

    // Feature flags (category + sub-feature toggles)
    modules: { type: Schema.Types.Mixed, default: {} },

    personality: {
      mood: { type: String, default: "story" },
      sass: { type: Number, default: 35 },
      narration: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.models.GuildSettings || mongoose.model("GuildSettings", GuildSettingsSchema);
