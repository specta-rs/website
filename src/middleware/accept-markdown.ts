import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import type { MiddlewareHandler } from "hono";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}",
  "/docs{/*path}/llms.mdx",
);

export default function acceptMarkdown(): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.path.endsWith("/llms.mdx")) {
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

      if (result) {
        const url = new URL(c.req.url);
        url.pathname = result;
        const assets = (c.env as { ASSETS?: { fetch: typeof fetch } }).ASSETS;
        const response = await (assets ?? { fetch }).fetch(
          new Request(url.toString(), c.req.raw),
        );
        const headers = new Headers(response.headers);
        headers.set("Vary", "Accept");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    await next();
  };
}

const stripSuffix = (s: string, w: string) =>
  s.endsWith(w) ? s.slice(0, -w.length) : s;
