import { createFromSource } from "fumadocs-core/search/server";
import type { SortedResult } from "fumadocs-core/search";
import referenceIndex from "@/lib/reference-index.json";
import { searchReference } from "@/lib/reference-search";
import { isIndexable, source } from "@/lib/source";

// Keep drafts (the hidden RFC pages) and the deprecated rspc 0.3.0 docs out of
// search results. `getPageTree` and the rest of the loader are inherited so the
// index still gets the same breadcrumbs.
const searchable = Object.assign(Object.create(source) as typeof source, {
  getPages: () => source.getPages().filter(isIndexable),
});

const guides = createFromSource(searchable, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: "english",
});

export async function GET(request: Request) {
  const response = await guides.GET(request);
  if (!response.ok) return response;
  const query = new URL(request.url).searchParams.get("query") || "";
  const results = (await response.json()) as SortedResult[];
  const references = searchReference(referenceIndex, query);
  // Keep guide discovery intact, while putting exact API-name matches first.
  const exact = references.filter(
    (item) => item.content.toLowerCase() === query.trim().toLowerCase(),
  );
  const other = references.filter((item) => !exact.includes(item));
  return Response.json([...exact, ...results, ...other]);
}
