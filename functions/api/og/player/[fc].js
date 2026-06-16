// holo/api/og/player/[fc].js
var VERCEL_OG = "https://project-1ahhd.vercel.app";
var R2_KEY = (fc) => `holo/og/player/${fc}.png`;
async function onRequest(context) {
  const { params, env } = context;
  const fc = params.fc;
  const vercelUrl = `${VERCEL_OG}/api/og/player?fc=${encodeURIComponent(fc)}&site=holo`;
  if (env.R2) {
    const cached = await env.R2.get(R2_KEY(fc));
    if (cached) {
      return new Response(cached.body, {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", "X-Cache": "HIT" }
      });
    }
  }
  const res = await fetch(vercelUrl);
  if (!res.ok) return new Response("OG generation failed", { status: 502 });
  const buf = await res.arrayBuffer();
  if (env.R2) {
    context.waitUntil(env.R2.put(R2_KEY(fc), buf, { httpMetadata: { contentType: "image/png" } }));
  }
  return new Response(buf, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", "X-Cache": env.R2 ? "MISS" : "BYPASS" }
  });
}
export {
  onRequest
};
