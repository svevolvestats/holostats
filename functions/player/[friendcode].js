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

// holo/player/[friendcode].js
async function onRequest(context) {
  const url = new URL(context.request.url);
  const origin = url.origin;
  const fc = context.params.friendcode;
  if (fc === "ranking") {
    return serveWithOG(context, {
      title: "\u9078\u624B\u30E9\u30F3\u30AD\u30F3\u30B0 | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40",
      description: "hololive OFFICIAL CARD GAME \u500B\u4EBA\u6226CS\u30E9\u30F3\u30AD\u30F3\u30B0",
      pageUrl: `${origin}/player/ranking`
    });
  }
  try {
    const [bloom, entry] = await Promise.all([
      fetchJson(`${origin}/data/players.json`).catch(() => ({})),
      fetchJson(`${origin}/data/entry_players.json`).catch(() => ({}))
    ]);
    const pb = bloom[fc];
    const pe = entry[fc];
    if (!pb && !pe) throw new Error("not found");
    const names = (pb?.names?.length ? pb.names : pe?.names) || [];
    const name = names[0] || fc;
    const stat = (k) => (pb?.[k] ?? 0) + (pe?.[k] ?? 0);
    const wins = stat("wins"), second = stat("second"), top8 = stat("top8");
    const desc = [
      wins ? `\u512A\u52DD\uFF1A${wins}\u56DE` : null,
      second ? `\u6E96\u512A\u52DD\uFF1A${second}\u56DE` : null,
      top8 ? `TOP8\uFF1A${top8}\u56DE` : null
    ].filter(Boolean).join(" ");
    return serveWithOG(context, {
      title: `${name} | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40`,
      description: desc,
      imageUrl: `${origin}/api/og/player/${encodeURIComponent(fc)}`,
      pageUrl: `${origin}/player/${encodeURIComponent(fc)}`
    });
  } catch {
    return context.env.ASSETS.fetch(new Request(`${origin}/index.html`));
  }
}
export {
  onRequest
};
