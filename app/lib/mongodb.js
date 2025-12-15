import mongoose from "mongoose";

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

export default async function dbConnect() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing env var: MONGODB_URI");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
