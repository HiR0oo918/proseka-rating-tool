const ASSET_RE = /^jacket_s_\d+$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  if (!ASSET_RE.test(asset)) {
    return new Response("invalid jacket", { status: 400 });
  }
  const url = `https://assets.unipjsk.com/startapp/music/jacket/${asset}/${asset}.png`;
  const upstream = await fetch(url);
  if (!upstream.ok) {
    return new Response("jacket not found", { status: 404 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
