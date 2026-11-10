import { useFrontmatter, usePage } from "@rspress/core/runtime";
import { Breadcrumb } from "./breadcrumb";
import { DeprecationBanner } from "./deprecation-banner";
import { CopyMarkdownButton, ViewOptions } from "./page-actions";

/**
 * The documentation header. Rspress normally renders a fallback `<h1>` from
 * the page title; `fallbackHeadingTitle` is disabled in the config so this
 * component can reproduce the old title, description and action row.
 */
export function DocsHeader() {
  const { page } = usePage();
  const { frontmatter } = useFrontmatter();
  const routePath = page.routePath.replace(/\/$/, "");
  const markdownUrl = page.pagePath.endsWith("/index.mdx")
    ? `${routePath}/index.md`
    : `${routePath}.md`;
  const deprecated = routePath.startsWith("/docs/rspc/0.3.0");
  const githubUrl = `https://github.com/specta-rs/website/blob/main/content/${page.pagePath}`;

  return (
    <div className="mb-4">
      <Breadcrumb />
      {deprecated ? <DeprecationBanner /> : null}

      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>

      {page.description ? (
        <p className="mt-2 text-lg text-fd-muted-foreground">
          {page.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-row items-center justify-between gap-2 border-b pb-6">
        <div className="flex flex-row items-center justify-between gap-x-2">
          <CopyMarkdownButton markdownUrl={markdownUrl} />
          <ViewOptions
            markdownUrl={markdownUrl}
            githubUrl={frontmatter.generated ? undefined : githubUrl}
          />
        </div>
      </div>
    </div>
  );
}
