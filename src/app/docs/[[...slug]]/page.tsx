import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  PageLastUpdate,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { LLMCopyButton, ViewOptions } from "@/components/page-actions";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { SquarePen } from "lucide-react";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.longTitle || page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">
        {page.data.description}
      </DocsDescription>
      <div className="flex flex-row justify-between gap-2 items-center border-b pt-2 pb-6">
        <div className="flex flex-row justify-between gap-x-2 items-center">
          <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
          <ViewOptions
            markdownUrl={`${page.url}.mdx`}
            githubUrl={`https://github.com/specta-rs/website/blob/main/docs/content/docs/${page.path}`}
          />
        </div>
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>

      <div className="flex items-center justify-between">
        <a
          href={`https://github.com/specta-rs/website/blob/main/content/docs/${page.path}`}
          rel="noreferrer noopener"
          target="_blank"
          className="w-fit border rounded-lg py-1.5 px-2 font-medium text-xs text-fd-secondary-foreground bg-fd-secondary transition-colors hover:text-fd-accent-foreground hover:bg-fd-accent inline-flex items-center gap-1.5"
        >
          <SquarePen className="size-3.5" />
          Edit on GitHub
        </a>
        {page.data.lastModified && (
          <PageLastUpdate date={page.data.lastModified} />
        )}
      </div>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.longTitle || page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
    robots: page.data.hidden ? { index: false } : undefined,
  };
}
