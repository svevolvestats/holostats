// _shared.js
var R2_BASE = "https://pub-bdbcbaf7e9804fe7a47da87d11c7064c.r2.dev";
var CACHE_NAME = "sve-og-v1";
async function fetchJson(url) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) return cached.json();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} \u2192 ${res.status}`);
  const text = await res.text();
  await cache.put(url, new Response(text, {
    headers: { "Content-Type": "application/json", "Cache-Control": "max-age=3600" }
  }));
  return JSON.parse(text);
}
function cardImageUrl(print) {
  if (!print?.image_url) return null;
  const filename = print.image_url.split("/").pop();
  return `${R2_BASE}/images/${print.expansion}/${filename}`;
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function injectOG(html, { title, description, imageUrl, pageUrl }) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeHtml(title)}$2`
  );
  const descEscaped = escapeHtml(description);
  const prevOut = out;
  out = out.replace(
    /(<meta property="og:description" content=")[\s\S]*?(")/,
    `$1${descEscaped}$2`
  );
  if (out === prevOut) console.warn("[injectOG] og:description replacement failed \u2014 tag missing or malformed in index.html");
  out = out.replace(/<meta property="og:url"[^>]*>/g, "");
  out = out.replace(/<meta property="og:image"[^>]*>/g, "");
  out = out.replace(/<meta name="twitter:image"[^>]*>/g, "");
  const extra = [
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : "",
    imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ""
  ].filter(Boolean).join("\n  ");
  out = out.replace("</head>", `  ${extra}
</head>`);
  return out;
}
async function serveWithOG(context, ogProps) {
  const origin = new URL(context.request.url).origin;
  const indexRes = await context.env.ASSETS.fetch(new Request(`${origin}/index.html`));
  const html = await indexRes.text();
  return new Response(injectOG(html, ogProps), {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}

// holo/card/[id].js
function holoCardImageUrl(print) {
  if (!print?.image_url) return null;
  if (/^https?:\/\//.test(print.image_url)) return print.image_url;
  return cardImageUrl(print);
}
function holoDesc(oracle) {
  const parts = [];
  if (oracle.oshi_skill?.text) parts.push(oracle.oshi_skill.text);
  if (oracle.sp_oshi_skill?.text) parts.push(oracle.sp_oshi_skill.text);
  if (oracle.keyword?.text) parts.push(oracle.keyword.text);
  for (const a of oracle.arts || []) if (a.text) parts.push(a.text);
  if (oracle.ability_text) parts.push(oracle.ability_text);
  const text = parts.join(" ").replace(/\n/g, " ").trim();
  return text.slice(0, 150) || "hololive OFFICIAL CARD GAME \u30AB\u30FC\u30C9";
}
async function onRequest(context) {
  const { params, request } = context;
  const cardId = decodeURIComponent(params.id);
  const origin = new URL(request.url).origin;
  try {
    const [oracles, prints] = await Promise.all([
      fetchJson(`${origin}/data/oracles.json`),
      fetchJson(`${origin}/data/prints.json`)
    ]);
    const printBySiteId = Object.fromEntries(prints.map((p) => [p.site_id, p]));
    const idLower = cardId.toLowerCase();
    const oracle = oracles.find((o) => o.oracle_id === cardId) || oracles.find((o) => o.oracle_id.toLowerCase() === idLower);
    if (!oracle) throw new Error("not found");
    const print = printBySiteId[oracle.canonical_print];
    return serveWithOG(context, {
      title: `${oracle.name} | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40`,
      description: holoDesc(oracle),
      imageUrl: holoCardImageUrl(print),
      pageUrl: `${origin}/card/${cardId}`
    });
  } catch {
    return context.env.ASSETS.fetch(new Request(`${origin}/index.html`));
  }
}
export {
  onRequest
};
