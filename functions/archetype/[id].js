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

// holo/archetype/[id].js
function holoCardImageUrl(print) {
  if (!print?.image_url) return null;
  if (/^https?:\/\//.test(print.image_url)) return print.image_url;
  return cardImageUrl(print);
}
async function onRequest(context) {
  const { params, request } = context;
  const ua = request.headers.get("user-agent") || "";
  const isBot = /discord|slack|twitter|facebook|kakao|bot/i.test(ua);
  if (!isBot) {
    const origin2 = new URL(request.url).origin;
    return context.env.ASSETS.fetch(new Request(`${origin2}/index.html`));
  }
  const archId = decodeURIComponent(params.id);
  const url = new URL(request.url);
  const origin = url.origin;
  const eraKey = url.searchParams.get("era") || "";
  const [cup, era, period] = eraKey.split(":");
  try {
    if (!cup || !era || !period) throw new Error("missing era param");
    const base = cup === "entry" ? `${origin}/data/entry_meta/${era}/${period}` : `${origin}/data/meta/${era}/${period}`;
    const [meta, oracles, prints] = await Promise.all([
      fetchJson(`${base}/meta.json`),
      fetchJson(`${origin}/data/oracles.json`),
      fetchJson(`${origin}/data/prints.json`)
    ]);
    const arch = meta.archetypes?.find((a) => a.id === archId);
    if (!arch) throw new Error("not found");
    const oracleById = Object.fromEntries(oracles.map((o) => [o.oracle_id, o]));
    const printBySiteId = Object.fromEntries(prints.map((p) => [p.site_id, p]));
    let imageUrl = null;
    const candidates = [...arch.top_cards || [], arch.oshi_id].filter(Boolean);
    for (const cardno of candidates) {
      const oracle = oracleById[cardno];
      if (oracle) {
        const img = holoCardImageUrl(printBySiteId[oracle.canonical_print]);
        if (img) {
          imageUrl = img;
          break;
        }
      }
    }
    const archName = arch.name || arch.member || archId;
    const cupLabel = cup === "entry" ? "\u30A8\u30F3\u30C8\u30EA\u30FC" : "\u30D6\u30EB\u30FC\u30E0";
    const ctxLabel = `${era} ${cupLabel} ${period}`;
    const title = `${archName}\uFF08${ctxLabel}\uFF09 | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40`;
    const winPct = ((arch.win_share ?? 0) * 100).toFixed(2);
    const top8Pct = ((arch.top8_share ?? 0) * 100).toFixed(2);
    const desc = `\u512A\u52DD: ${arch.winner ?? 0}\u56DE(${winPct}%) | TOP8: ${arch.count ?? 0}\u56DE(${top8Pct}%)`;
    return await serveWithOG(context, {
      title,
      description: desc,
      imageUrl,
      pageUrl: `${origin}/archetype/${archId}?era=${encodeURIComponent(eraKey)}`
    });
  } catch {
    return context.env.ASSETS.fetch(new Request(`${origin}/index.html`));
  }
}
export {
  onRequest
};
