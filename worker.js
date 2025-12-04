
export default {
  async fetch(request, env) {
    return new Response("Cloudflare Worker Initialized. Please wait for build...", {
      headers: { "content-type": "text/plain" },
    });
  },
};