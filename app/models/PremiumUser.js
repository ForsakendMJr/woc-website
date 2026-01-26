import mongoose from "mongoose";

const TIER_ORDER = ["free", "supporter", "supporter_plus", "supporter_plus_plus"];

const PremiumUserSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },

    tier: { type: String, enum: TIER_ORDER, default: "free", index: true },

    // optional expiry. null = never expires
    expiresAt: { type: Date, default: null },

    // optional note/admin metadata
    note: { type: String, default: "" },

    // optional misc metadata (stripe ids later etc.)
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.PremiumUser ||
  mongoose.model("PremiumUser", PremiumUserSchema);

export { TIER_ORDER };
