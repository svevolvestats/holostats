// _shared.js
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

// holo/venue-global/[id].js
var COUNTRY_NAME = { 2: "United States", 3: "Singapore", 4: "United Kingdom", 5: "Canada", 13: "Argentina", 15: "Australia", 16: "Austria", 23: "Belgium", 40: "Brazil", 44: "Costa Rica", 45: "Croatia", 50: "Denmark", 65: "France", 69: "Germany", 71: "Greece", 79: "Hong Kong", 80: "Hungary", 83: "Indonesia", 88: "Italy", 105: "Lithuania", 107: "Macau", 111: "Malaysia", 118: "Mexico", 126: "Myanmar", 130: "Netherlands", 131: "New Zealand", 145: "Peru", 146: "Philippines", 147: "Poland", 148: "Portugal", 170: "South Korea", 172: "Spain", 177: "Sweden", 178: "Switzerland", 180: "Taiwan", 183: "Thailand", 199: "Vietnam" };
function venueId(name) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) + h ^ name.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
async function onRequest(context) {
  const { params, request } = context;
  const id = decodeURIComponent(params.id);
  const url = new URL(request.url);
  const origin = url.origin;
  const gtid = url.searchParams.get("gtid") || "";
  try {
    const venueInfo = await fetchJson(`${origin}/data/venue_info_global.json`);
    const venueName = Object.keys(venueInfo).find((name) => venueId(name) === id);
    if (!venueName) throw new Error("not found");
    const info = venueInfo[venueName];
    const country = COUNTRY_NAME[info.country_id] || null;
    const addr = [info.city_address, country].filter(Boolean).join(", ");
    const description = addr ? `${addr} \u2014 hololive OFFICIAL CARD GAME` : "hololive OFFICIAL CARD GAME";
    return serveWithOG(context, {
      title: `${venueName} | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40`,
      description,
      imageUrl: `${origin}/api/og/venue/${id}`,
      pageUrl: `${origin}/venue-global/${id}${gtid ? `?gtid=${gtid}` : ""}`
    });
  } catch {
    return context.env.ASSETS.fetch(new Request(`${origin}/index.html`));
  }
}
export {
  onRequest
};
