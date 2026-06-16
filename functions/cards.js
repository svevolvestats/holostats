// _shared.js
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

// holo/cards.js
async function onRequest(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get("q") || "";
  const qDisplay = q.replace(/([^<>=\s]*)>=(\d+)/g, "$1$2\u4EE5\u4E0A").replace(/([^<>=\s]*)<=(\d+)/g, "$1$2\u4EE5\u4E0B").replace(/([^<>=\s]*)>(\d+)/g, "$1$2\u8D85\u904E").replace(/([^<>=\s]*)<(\d+)/g, "$1$2\u672A\u6E80");
  const title = q ? `\u300C${qDisplay}\u300D\u306E\u691C\u7D22\u7D50\u679C | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40` : "\u30AB\u30FC\u30C9\u691C\u7D22 | \u30DB\u30ED\u30AB\u7D71\u8A08\u5C40";
  const description = q ? `hololive OFFICIAL CARD GAME\u300C${qDisplay}\u300D\u306E\u30AB\u30FC\u30C9\u691C\u7D22\u7D50\u679C` : "hololive OFFICIAL CARD GAME \u30AB\u30FC\u30C9\u691C\u7D22";
  return serveWithOG(context, {
    title,
    description,
    pageUrl: q ? `${url.origin}/cards?q=${encodeURIComponent(q)}` : `${url.origin}/cards`
  });
}
export {
  onRequest
};
