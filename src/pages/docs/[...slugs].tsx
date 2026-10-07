import type { PageProps } from "waku/router";
import { unstable_notFound } from "waku/router/server";
import { DocsPageContent } from "@/components/docs-page-content";
import { source } from "@/lib/source";

export default function DocPage({ slugs }: PageProps<"/docs/[...slugs]">) {
  const page = source.getPage(slugs);
  if (!page) unstable_notFound();

  return <DocsPageContent slugs={slugs} />;
}

export async function getConfig() {
  const pages = source
    .generateParams()
    .map((item) => (item.lang ? [item.lang, ...item.slug] : item.slug));

  return {
    render: "static" as const,
    staticPaths: pages,
  } as const;
}
