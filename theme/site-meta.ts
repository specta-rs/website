export const canonical = "https://specta.dev";
export const openGraphImageSize = [1200, 630] as const;

/** Where a page's OG image lives, matching the old `/docs/<page>/og.png` URLs. */
export function ogRoute(routePath: string) {
  if (routePath === "/" || routePath === "/docs") return "/docs/og.png";
  return `${routePath.replace(/\/$/, "")}/og.png`;
}

/**
 * Where the generated Markdown copy lives. Index pages use `<page>/index.md`;
 * ordinary pages use `<page>.md`.
 */
export function markdownPath(routePath: string, pagePath: string) {
  const path = routePath.replace(/\/$/, "");
  return pagePath.endsWith("/index.mdx") ? `${path}/index.md` : `${path}.md`;
}
