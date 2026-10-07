// This endpoint proxies requests to PostHog's API.
// It has a random name to make blocking less likely.

import type { ApiContext } from "waku/router";

export default async function handler(
  request: Request,
  { params }: ApiContext<"/_api/ph_ebbd7f/[...slug]">,
) {
  const originalUrl = new URL(request.url);
  const slug = params.slug.join("/");
  // // Determine target hostname based on static or dynamic ingestion
  const hostname = params.slug[0] === "static"
    ? "us-assets.i.posthog.com" // change us to eu for EU Cloud
    : "us.i.posthog.com"; // change us to eu for EU Cloud

  // Build external URL
  const url = new URL(request.url);
  url.protocol = "https:";
  url.hostname = hostname;
  url.port = "443";
  url.pathname = `/${slug}`;

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const headers = new Headers(request.headers);
  headers.set("Accept-Encoding", "");
  headers.set("host", hostname);
  headers.delete("cookie");
  headers.set("X-Forwarded-For", ip);

  // Proxy the request to the external host
  const res = await fetch(url.toString(), {
    method: request.method,
    headers,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.arrayBuffer()
        : null,
    redirect: request.redirect,
  });

  // This is required for `headers.ts` middleware to work on Node.
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers),
  });
}
