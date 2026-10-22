import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import type { Context, MiddlewareHandler } from "hono";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}",
  "/docs{/*path}/llms.mdx",
);

type AssetsBinding = { fetch: typeof fetch };

/**
 * Waku prerenders two kinds of file under `/docs`: the markdown route
 * (`llms.mdx`) and the OpenGraph image (`og.png`). Neither has a runtime
 * function in the Worker, so a request that reaches the Waku router throws
 * `defineRouter: no runtime function found for api ...; rebuild required` and
 * returns 500. Cloudflare normally serves them from the asset worker (the
 * `run_worker_first` negative rules), but serve them here too so a routing
 * change cannot break them.
 *
 * Markdown negotiation (`Accept: text/markdown`, or the `.mdx` suffix) also
 * resolves to the `llms.mdx` asset.
 */
export default function acceptMarkdown(): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path;

    // A generated file requested directly.
    if (isGeneratedFile(path)) {
      const assets = getAssets(c);
      if (assets) return serveAsset(c, assets, path, path.endsWith(".mdx"));
      await next();
      return;
    }

    const endsWithMdx = path.endsWith(".mdx");
    if (
      path.startsWith("/docs") &&
      (isMarkdownPreferred(c.req.raw) || endsWithMdx)
    ) {
      const result = rewriteLLM(endsWithMdx ? stripSuffix(path, ".mdx") : path);

      // `ASSETS` only exists on Cloudflare; the Node dev server resolves the
      // rewritten URL through its own routes.
      if (result) {
        return serveAsset(c, getAssets(c) ?? { fetch }, result, true);
      }
    }

    await next();
  };
}

const isGeneratedFile = (path: string) =>
  path.startsWith("/docs") &&
  (path.endsWith("/llms.mdx") || path.endsWith("/og.png"));

function getAssets(c: Context): AssetsBinding | undefined {
  return (c.env as { ASSETS?: AssetsBinding }).ASSETS;
}

async function serveAsset(
  c: Context,
  assets: AssetsBinding,
  pathname: string,
  markdown: boolean,
) {
  const url = new URL(c.req.url);
  url.pathname = pathname;
  const response = await assets.fetch(new Request(url.toString(), c.req.raw));

  const headers = new Headers(response.headers);
  headers.set("Vary", "Accept");
  if (markdown) {
    // Cloudflare infers `text/mdx` from the generated `.mdx` asset name. The
    // response is markdown, so label it as such.
    headers.set("Content-Type", "text/markdown; charset=utf-8");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const stripSuffix = (s: string, w: string) =>
  s.endsWith(w) ? s.slice(0, -w.length) : s;
