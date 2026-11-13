export const canonical = "https://specta.dev";
export const openGraphImageSize = [1200, 630] as const;

/** Where a page's OG image lives, matching the old `/docs/<page>/og.png` URLs. */
export function ogRoute(routePath: string) {
  return `${routePath.replace(/\/$/, "")}/og.png`;
}

/**
 * Page titles are Markdown so headings can carry inline code, which a plain
 * text context such as the generated OG card cannot render. Rspress's own
 * inline parser imports stylesheets, so it cannot be used while the config
 * loads; this strips the markers we actually use in titles instead.
 */
export function plainTitle(title: string) {
  return title
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

/**
 * Where the generated Markdown copy lives. Index pages use `<page>/index.md`;
 * ordinary pages use `<page>.md`.
 */
export function markdownPath(routePath: string, pagePath: string) {
  const path = routePath.replace(/\/$/, "");
  return pagePath.endsWith("/index.mdx") ? `${path}/index.md` : `${path}.md`;
}
