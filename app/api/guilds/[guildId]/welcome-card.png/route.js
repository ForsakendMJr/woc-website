export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  return Response.json({
    url: req.url,
    ctxKeys: Object.keys(ctx || {}),
    params: ctx?.params ?? null,
  });
}
