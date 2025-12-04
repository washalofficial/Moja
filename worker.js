
export default {
  async fetch(request, env) {
    return new Response("Hello from Moja  on Cloudflare!", {
      headers: { "content-type": "text/plain" },
    });
  },
};