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

// holo/index.js
async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  const eraKey = url.searchParams.get("era");
  try {
    let periodStr = "";
    let imageUrl = `${origin}/og/meta.png`;
    let pageUrl = origin;
    if (eraKey) {
      const [cup, era, period] = eraKey.split(":");
      if (cup && era && period) {
        const base = cup === "entry" ? `${origin}/data/entry_meta/${era}/${period}` : `${origin}/data/meta/${era}/${period}`;
        const meta = await fetchJson(`${base}/meta.json`);
        const p = meta.period ?? {};
        const cupLabel = cup === "entry" ? "\u30A8\u30F3\u30C8\u30EA\u30FC" : "\u30D6\u30EB\u30FC\u30E0";
        periodStr = `\uFF08${era} ${cupLabel} ${p.start ?? ""}\u301C${p.end ?? ""}\uFF09`;
        imageUrl = `${origin}/og/meta/${cup}/${era}/${period}.png`;
        pageUrl = `${origin}/?era=${encodeURIComponent(eraKey)}`;
      }
    } else {
      const meta = await fetchJson(`${origin}/data/meta.json`);
      const p = meta.period ?? {};
      periodStr = p.start && p.end ? `\uFF08${p.start}\u301C${p.end}\uFF09` : "";
    }
    const title = `\u500B\u4EBA\u6226CS\u74B0\u5883${periodStr} | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40`;
    const indexRes = await env.ASSETS.fetch(new Request(`${origin}/index.html`));
    const html = await indexRes.text();
    return new Response(injectOG(html, { title, description: "", imageUrl, pageUrl }), {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch {
    return env.ASSETS.fetch(new Request(`${origin}/index.html`));
  }
}
export {
  onRequest
};
