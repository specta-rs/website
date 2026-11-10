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
  const [imageWidth, imageHeight] = openGraphImageSize;
  const isDoc = page.pageType === "doc" || page.pageType === "doc-wide";
  const imageMeta = (prefix: "og:image" | "twitter:image") => [
    { property: prefix, content: image },
    { property: `${prefix}:width`, content: String(imageWidth) },
    { property: `${prefix}:height`, content: String(imageHeight) },
    { property: `${prefix}:type`, content: "image/png" },
    { property: `${prefix}:alt`, content: "Oscar Beaumont" },
  ];

  useHead({
    // The old site used bare page titles. Rspress appends the site title to
    // document pages, so override it here for docs (and keep the site title on
    // the landing page).
    ...(isDoc && page.title ? { title: page.title } : {}),
    meta: [
      { property: "og:locale", content: "en_US" },
      ...imageMeta("og:image"),
      { property: "twitter:card", content: "summary_large_image" },
      ...imageMeta("twitter:image"),
      ...(frontmatter?.search === false
        ? [{ name: "robots", content: "noindex" }]
        : []),
    ],
  });

  return null;
}
