import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import type { Context, MiddlewareHandler } from "hono";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}",
  "/docs{/*path}/llms.mdx",
);

type AssetsBinding = { fetch: typeof fetch };

export default function acceptMarkdown(): MiddlewareHandler {
  return async (c, next) => {
    // A generated markdown asset requested directly. Cloudflare normally serves
    // these from the asset worker, but a request that reaches the Worker must
    // not fall through to the Waku router: the prerendered route has no runtime
    // function, so the router throws
    // `defineRouter: no runtime function found for api ...; rebuild required`.
    if (c.req.path.endsWith("/llms.mdx")) {
      if (getAssets(c)) return serveMarkdownAsset(c, c.req.path);
      await next();
      return;
    }

    const endsWithMdx = c.req.path.endsWith(".mdx");
    if (
      c.req.path.startsWith("/docs") &&
      (isMarkdownPreferred(c.req.raw) || endsWithMdx)
    ) {
      const result = rewriteLLM(
        endsWithMdx ? stripSuffix(c.req.path, ".mdx") : c.req.path,
      );

      if (result) return serveMarkdownAsset(c, result);
    }

    await next();
  };
}

function getAssets(c: Context): AssetsBinding | undefined {
  return (c.env as { ASSETS?: AssetsBinding }).ASSETS;
}

async function serveMarkdownAsset(c: Context, pathname: string) {
  const url = new URL(c.req.url);
  url.pathname = pathname;

  const assets = getAssets(c) ?? { fetch };
  const response = await assets.fetch(new Request(url.toString(), c.req.raw));

  const headers = new Headers(response.headers);
  headers.set("Vary", "Accept");
  // Cloudflare infers `text/mdx` from the generated `.mdx` asset name. The
  // negotiated response is markdown, so label it as such.
  headers.set("Content-Type", "text/markdown; charset=utf-8");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const stripSuffix = (s: string, w: string) =>
  s.endsWith(w) ? s.slice(0, -w.length) : s;
