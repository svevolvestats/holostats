// holo/[[catchall]].js
async function onRequest(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;
  return env.ASSETS.fetch(new Request(`${origin}/index.html`));
}
export {
  onRequest
};
