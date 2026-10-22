import { createFromSource } from "fumadocs-core/search/server";
import { isDeprecatedPage, source } from "@/lib/source";

// Keep drafts (the hidden RFC pages) and the deprecated rspc 0.3.0 docs out of
// search results. `getPageTree` and the rest of the loader are inherited so the
// index still gets the same breadcrumbs.
const searchable = Object.assign(Object.create(source) as typeof source, {
  getPages: () =>
    source
      .getPages()
      .filter((page) => !page.data.hidden && !isDeprecatedPage(page.slugs)),
});

export const { GET } = createFromSource(searchable, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: "english",
});
