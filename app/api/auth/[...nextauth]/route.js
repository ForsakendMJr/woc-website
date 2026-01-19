// app/api/auth/[...nextauth]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Next build can "touch" route modules while collecting data.
 * If NextAuth is invoked at module scope and import interop is off,
 * it can throw (TypeError: l is not a function).
 *
 * So we load everything lazily inside GET/POST.
 */

async function getHandler() {
  const nextAuthMod = await import("next-auth");
  const { authOptions } = await import("./authOptions.js");

  // ESM/CJS interop safety: handle both default and module export shapes
  const NextAuth = nextAuthMod?.default ?? nextAuthMod;

  if (typeof NextAuth !== "function") {
    // This is the exact failure you’re seeing, but now it’s explicit.
    throw new Error(
      `NextAuth import is not a function. Got: ${typeof NextAuth}. ` +
        `This usually means a duplicate next-auth install or wrong import shape.`
    );
  }

  return NextAuth(authOptions);
}

export async function GET(req, ctx) {
  const handler = await getHandler();
  return handler(req, ctx);
}

export async function POST(req, ctx) {
  const handler = await getHandler();
  return handler(req, ctx);
}
