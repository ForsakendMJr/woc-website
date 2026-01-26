// models/UserEntitlement.js
import mongoose from "mongoose";

const UserEntitlementSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },

    // simple tiers: free | premium | premium_plus (expand later)
    tier: { type: String, default: "free" },

    // allow timed subs
    active: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },

    // optional bookkeeping
    source: { type: String, default: "manual" }, // "stripe" later
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.UserEntitlement ||
  mongoose.model("UserEntitlement", UserEntitlementSchema);
