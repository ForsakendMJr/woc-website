// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import { getAuthOptions } from "./authOptions";

export const runtime = "nodejs";     // NextAuth wants node runtime
export const dynamic = "force-dynamic";

const handler = NextAuth(getAuthOptions());

export { handler as GET, handler as POST };
