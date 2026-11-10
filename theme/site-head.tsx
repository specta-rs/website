import { useHead, usePage } from "@rspress/core/runtime";
import { canonical, ogRoute, openGraphImageSize } from "./site-meta";

/**
 * Adds the social metadata the old site emitted from `Meta.tsx`. Rspress only
 * generates `og:title`/`og:description` by default, so the image dimensions,
 * Twitter card and noindex directive are added here.
 */
export function SiteHead() {
  const { page } = usePage();
  const frontmatter = page.frontmatter as { search?: boolean } | undefined;
  const image = `${canonical}${ogRoute(page.routePath)}`;
  const isDoc = page.pageType === "doc" || page.pageType === "doc-wide";

  useHead({
    // The old site used bare page titles. Rspress appends the site title to
    // document pages, so override it here for docs (and keep the site title on
    // the landing page).
    ...(isDoc && page.title ? { title: page.title } : {}),
    meta: [
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: image },
      {
        property: "og:image:width",
        content: String(openGraphImageSize[0]),
      },
      {
        property: "og:image:height",
        content: String(openGraphImageSize[1]),
      },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: "Oscar Beaumont" },
      { property: "twitter:card", content: "summary_large_image" },
      { property: "twitter:image", content: image },
      {
        property: "twitter:image:width",
        content: String(openGraphImageSize[0]),
      },
      {
        property: "twitter:image:height",
        content: String(openGraphImageSize[1]),
      },
      { property: "twitter:image:type", content: "image/png" },
      { property: "twitter:image:alt", content: "Oscar Beaumont" },
      ...(frontmatter?.search === false
        ? [{ name: "robots", content: "noindex" }]
        : []),
    ],
  });

  return null;
}
