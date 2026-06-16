// holo/api/og/venue/[id].js
var VERCEL_OG = "https://project-1ahhd.vercel.app";
function cacheKey(id) {
  const now = /* @__PURE__ */ new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `holo/og/venue/${id}-${ym}.png`;
}
async function onRequest(context) {
  const { params, env } = context;
  const id = params.id;
  const key = cacheKey(id);
  const vercelUrl = `${VERCEL_OG}/api/og/venue?id=${encodeURIComponent(id)}&site=holo`;
  if (env.R2) {
    const cached = await env.R2.get(key);
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
    context.waitUntil(env.R2.put(key, buf, { httpMetadata: { contentType: "image/png" } }));
  }
  return new Response(buf, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", "X-Cache": env.R2 ? "MISS" : "BYPASS" }
  });
}
export {
  onRequest
};
