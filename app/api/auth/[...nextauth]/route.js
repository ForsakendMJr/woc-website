import NextAuth from "next-auth";
import { authOptions } from "./authOptions";

export const runtime = "nodejs"; // IMPORTANT: next-auth v4 should run on node, not edge

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
