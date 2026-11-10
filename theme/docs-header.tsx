import { useFrontmatter, usePage } from "@rspress/core/runtime";
import { Breadcrumb } from "./breadcrumb";
import { markdownPath } from "./site-meta";
import { DeprecationBanner } from "./deprecation-banner";
import { CopyMarkdownButton, ViewOptions } from "./page-actions";

/**
 * The documentation header. Rspress normally renders a fallback `<h1>` from
 * the page title; `fallbackHeadingTitle` is disabled in the config so this
 * component can lay out the breadcrumb, title, description and actions as one
 * block. Actions sit beside the title on wide screens and wrap underneath on
 * narrow ones.
 */
export function DocsHeader() {
  const { page } = usePage();
  const { frontmatter } = useFrontmatter();
  const markdownUrl = markdownPath(page.routePath, page.pagePath);
  const deprecated = page.routePath.startsWith("/docs/rspc/0.3.0");
  const githubUrl = frontmatter.generated
    ? undefined
    : `https://github.com/specta-rs/website/blob/main/content/${page.pagePath}`;

  return (
    <header className="sp-doc-head">
      <Breadcrumb />
      {deprecated ? <DeprecationBanner /> : null}

      <div className="sp-doc-head__grid">
        <h1 className="sp-doc-title">{page.title}</h1>

        <div className="sp-doc-actions">
          <CopyMarkdownButton markdownUrl={markdownUrl} />
          <ViewOptions markdownUrl={markdownUrl} githubUrl={githubUrl} />
        </div>

        {page.description ? (
          <p className="sp-doc-deck">{page.description}</p>
        ) : null}
      </div>
    </header>
  );
}
