import type { MiddlewareHandler } from "hono";
import _headers from "virtual:_headers";

export default function headers(): MiddlewareHandler {
  return async (c, next) => {
    for (const [header, value] of Object.entries(_headers["/*"]))
      c.res.headers.set(header, value);
    await next();
  };
}
