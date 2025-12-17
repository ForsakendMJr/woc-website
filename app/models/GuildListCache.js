import mongoose from "mongoose";

const GuildListCacheSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, index: true },
    guilds: { type: Array, default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.GuildListCache ||
  mongoose.model("GuildListCache", GuildListCacheSchema);
