// assets/[[path]].js
async function onRequest({ request, env }) {
  const res = await env.ASSETS.fetch(request);
  const ct = res.headers.get("Content-Type") || "";
  if (ct.includes("text/html")) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return out;
}
export {
  onRequest
};
