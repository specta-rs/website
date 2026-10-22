import { isDeprecatedPage, source } from "@/lib/source";

const canonical = "https://specta.dev";

// The site is far below the 50,000 URL sitemap limit, so a single file is
// enough. Deprecated and hidden pages are left out so search engines only see
// the documentation we want indexed.
export async function GET() {
  const pages = source
    .getPages()
    .filter((page) => !page.data.hidden && !isDeprecatedPage(page.slugs));

  const entries: { loc: string; lastmod?: string }[] = [
    { loc: `${canonical}/` },
    ...pages.map((page) => ({
      loc: `${canonical}${page.url}`,
      lastmod: page.data.lastModified?.toISOString(),
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(({ loc, lastmod }) =>
    lastmod
      ? `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
      : `  <url>\n    <loc>${loc}</loc>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

export function getConfig() {
  return {
    render: "static",
  } as const;
}
