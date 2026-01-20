export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler() {
  const nextAuthMod = await import("next-auth");
  const { getAuthOptions } = await import("./authOptions.js");

  const NextAuth = nextAuthMod?.default ?? nextAuthMod;
  if (typeof NextAuth !== "function") {
    throw new Error(`NextAuth import is not a function. Got: ${typeof NextAuth}.`);
  }

  const authOptions = await getAuthOptions();
  return NextAuth(authOptions);
}

export async function GET(req) {
  const handler = await getHandler();
  return handler(req);
}

export async function POST(req) {
  const handler = await getHandler();
  return handler(req);
}
