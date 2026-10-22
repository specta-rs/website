import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { SquarePen } from "lucide-react";
import { DeprecationBanner } from "@/components/deprecation-banner";
import { Meta } from "@/components/Meta";
import { LLMCopyButton, ViewOptions } from "@/components/page-actions";
import { getPageImage, isDeprecatedPage, source } from "@/lib/source";
import { type TOCItemType } from "fumadocs-core/toc";
import type { ComponentProps } from "react";
import { getMDXComponents } from "@/mdx-components";

// Symbol listings would otherwise bury the page's real sections, so generated
// reference pages keep only their category headings in the table of contents.
function visibleToc(items: TOCItemType[]): TOCItemType[] {
  return items.filter((item) => item.depth <= 2);
}

// A symbol heading is one of hundreds on a page, so it renders without the
// anchor-link icon the guide headings carry. The heading id still comes from the
// MDX pipeline, so anchors and search deep links keep working.
function SymbolHeading({ id, children, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      id={id}
      className="mt-6 scroll-mt-24 text-base font-semibold"
      {...props}
    >
      {children}
    </h3>
  );
}

export function DocsPageContent({ slugs }: { slugs: string[] }) {
  const page = source.getPage(slugs);
  if (!page) throw new Error(`Missing docs page for slug: ${slugs.join("/")}`);

  const deprecated = isDeprecatedPage(page.slugs);
  const MDX = page.data.body;
  return (
    <DocsPage
      toc={page.data.generated ? visibleToc(page.data.toc) : page.data.toc}
      full={page.data.full}
    >
      <Meta
        title={page.data.longTitle || page.data.title}
        description={page.data.description}
        openGraphImage={getPageImage(page).url}
      />
      {page.data.hidden || deprecated ? (
        <meta name="robots" content="noindex" />
      ) : null}

      {deprecated ? <DeprecationBanner /> : null}

      <DocsTitle>{page.data.longTitle || page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">
        {page.data.description}
      </DocsDescription>
      <div className="flex flex-row justify-between gap-2 items-center border-b pt-2 pb-6">
        <div className="flex flex-row justify-between gap-x-2 items-center">
          <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
          <ViewOptions
            markdownUrl={`${page.url}.mdx`}
            githubUrl={
              page.data.generated
                ? undefined
                : `https://github.com/specta-rs/website/blob/main/content/docs/${page.path}`
            }
          />
        </div>
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
            ...(page.data.generated ? { h3: SymbolHeading } : {}),
          })}
        />
      </DocsBody>

      {page.data.generated ? null : (
        <a
          href={`https://github.com/specta-rs/website/blob/main/content/docs/${page.path}`}
          rel="noreferrer noopener"
          target="_blank"
          className="w-fit border rounded-lg py-1.5 px-2 font-medium text-xs text-fd-secondary-foreground bg-fd-secondary transition-colors hover:text-fd-accent-foreground hover:bg-fd-accent inline-flex items-center gap-1.5"
        >
          <SquarePen className="size-3.5" />
          Edit on GitHub
        </a>
      )}
    </DocsPage>
  );
}
