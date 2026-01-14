import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import type { MiddlewareHandler } from "hono";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}",
  "/docs{/*path}/llms.mdx",
);

export default function acceptMarkdown(): MiddlewareHandler {
  return async (c, next) => {
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
        c.req.raw = new Request(url.toString(), c.req.raw);
      }
    }

    await next();
  };
}

const stripSuffix = (s: string, w: string) =>
  s.endsWith(w) ? s.slice(0, -w.length) : s;
