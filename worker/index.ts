interface Env {
  ASSETS: Fetcher;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

const postHogPrefix = "/ph_ebbd7f/";

/**
 * Cloudflare Worker in front of the static Rspress build. It keeps three
 * behaviours that used to live in the Waku server:
 *
 * - proxy PostHog ingestion through `/ph_ebbd7f/*`;
 * - serve a page as Markdown when the client sends `Accept: text/markdown`;
 * - keep the old `.mdx` and `/llms.mdx` Markdown URLs working.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith(postHogPrefix)) {
      return proxyPostHog(request, url);
    }

    // Keep the conventional /favicon.ico URL working without putting the file
    // back in public/, where Rsbuild would inject it into every page.
    if (url.pathname === "/favicon.ico") {
      const target = new URL(url);
      target.pathname = "/assets/specta-favicon.ico";
      return env.ASSETS.fetch(new Request(target, request));
    }

    if (url.pathname.startsWith("/docs")) {
      if (url.pathname.endsWith(".md")) {
        return markdownResponse(await env.ASSETS.fetch(request));
      }

      if (url.pathname.endsWith(".mdx") || acceptsMarkdown(request)) {
        return serveMarkdown(request, env, url);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

function acceptsMarkdown(request: Request) {
  const accept = request.headers.get("Accept") ?? "";
  const markdown = quality(accept, "text/markdown");
  const html = quality(accept, "text/html");
  return markdown > 0 && markdown >= html;
}

function quality(accept: string, type: string) {
  for (const part of accept.split(",")) {
    const [mediaType, ...parameters] = part.trim().split(";");
    if (mediaType.toLowerCase() !== type) continue;
    const q = parameters.find((parameter) => parameter.trim().startsWith("q="));
    return q ? Number.parseFloat(q.split("=")[1]) : 1;
  }
  return 0;
}

async function serveMarkdown(request: Request, env: Env, url: URL) {
  const base = url.pathname
    .replace(/\/llms\.mdx$/, "")
    .replace(/\.mdx$/, "")
    .replace(/\/$/, "");

  // A page's Markdown can be either `<page>.md` or `<page>/index.md`. Try both
  // so index pages and ordinary pages share one negotiation path.
  for (const pathname of [`${base}.md`, `${base}/index.md`]) {
    const target = new URL(url);
    target.pathname = pathname;
    const response = await env.ASSETS.fetch(new Request(target, request));
    if (response.ok) return markdownResponse(response);
  }

  return env.ASSETS.fetch(request);
}

function markdownResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Vary", "Accept");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function proxyPostHog(request: Request, url: URL) {
  const slug = url.pathname.slice(postHogPrefix.length);
  // Static assets are served from a different PostHog host.
  const hostname =
    slug.split("/")[0] === "static"
      ? "us-assets.i.posthog.com"
      : "us.i.posthog.com";

  const target = new URL(url);
  target.protocol = "https:";
  target.hostname = hostname;
  target.port = "443";
  target.pathname = `/${slug}`;

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const headers = new Headers(request.headers);
  headers.set("Accept-Encoding", "");
  headers.set("host", hostname);
  headers.delete("cookie");
  headers.set("X-Forwarded-For", ip);

  const response = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.arrayBuffer()
        : null,
    redirect: "manual",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
  });
}
