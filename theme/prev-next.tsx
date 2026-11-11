import { useI18n, useLocation, useSidebar } from "@rspress/core/runtime";
import {
  IconArrowRight,
  Link,
  SvgWrapper,
  renderInlineMarkdown,
} from "@rspress/core/theme-original";

type Entry = { text?: string; link: string };

type SidebarNode = {
  text?: string;
  link?: string;
  items?: SidebarNode[];
};

/**
 * Rspress matches the current route against sidebar links with an exact string
 * comparison, so a page served as `/docs/` never matches its `/docs` sidebar
 * entry. When that happens the built-in footer falls back to the first sidebar
 * item, which makes the "Next page" card point back at the current section
 * (or at an unrelated page on routes that are deliberately absent from the
 * sidebar, such as the archived React/Solid guides).
 *
 * Normalise the trailing slash before matching and hide the footer when the
 * page genuinely has no neighbours.
 */
function routeKey(path: string) {
  const withoutQuery = path.split("#")[0].split("?")[0];
  const withoutHtml = withoutQuery
    .replace(/\/index\.html$/, "")
    .replace(/\.html$/, "");
  return withoutHtml !== "/" ? withoutHtml.replace(/\/+$/, "") : "/";
}

function isPageLink(link: string | undefined): link is string {
  return (
    typeof link === "string" && link.startsWith("/") && !link.startsWith("//")
  );
}

function flatten(items: readonly SidebarNode[], result: Entry[] = []) {
  for (const item of items) {
    if (Array.isArray(item.items)) {
      if (isPageLink(item.link))
        result.push({ text: item.text, link: item.link });
      flatten(item.items, result);
    } else if (isPageLink(item.link)) {
      result.push({ text: item.text, link: item.link });
    }
  }
  return result;
}

export function PrevNextPage() {
  const { pathname } = useLocation();
  const sidebar = useSidebar() as SidebarNode[];
  const t = useI18n();

  const pages = flatten(sidebar);
  const index = pages.findIndex(
    (page) => routeKey(page.link) === routeKey(pathname),
  );
  if (index === -1) return null;

  const prevPage = pages[index - 1] ?? null;
  const nextPage = pages[index + 1] ?? null;

  return (
    <div className="rp-prev-next-page">
      {prevPage ? (
        <Link
          href={prevPage.link}
          className="rp-prev-next-page__item rp-prev-next-page__prev"
        >
          <span className="rp-prev-next-page__item__desc">
            {t("prevPageText")}
          </span>
          <span className="rp-prev-next-page__item__title">
            <SvgWrapper
              icon={IconArrowRight}
              className="rp-prev-next-page__icon rp-prev-next-page__rotate_180"
            />
            <span {...renderInlineMarkdown(prevPage.text ?? "")} />
          </span>
        </Link>
      ) : (
        <div className="rp-prev-next-page__placeholder" />
      )}
      {nextPage ? (
        <Link
          href={nextPage.link}
          className="rp-prev-next-page__item rp-prev-next-page__next"
        >
          <span className="rp-prev-next-page__item__desc">
            {t("nextPageText")}
          </span>
          <span className="rp-prev-next-page__item__title">
            <span {...renderInlineMarkdown(nextPage.text ?? "")} />
            <SvgWrapper
              icon={IconArrowRight}
              className="rp-prev-next-page__icon"
            />
          </span>
        </Link>
      ) : (
        <div className="rp-prev-next-page__placeholder" />
      )}
    </div>
  );
}
