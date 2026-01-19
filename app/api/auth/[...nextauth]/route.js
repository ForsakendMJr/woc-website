import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// NextAuth v4 App Router handler
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
