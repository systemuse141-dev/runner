// Cloudflare Worker Entrypoint for Mudrexx Earn
export interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // If static asset binding is available (Cloudflare Workers Sites / Assets)
    if (env.ASSETS) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
        // Fallback to index.html for client-side routing
        const spaRequest = new Request(new URL('/', request.url).toString(), request);
        return await env.ASSETS.fetch(spaRequest);
      } catch (e) {
        // Continue to fallback
      }
    }

    return new Response('Mudrexx Earn Royal Training Terminal', {
      headers: { 'content-type': 'text/plain' },
    });
  },
};
