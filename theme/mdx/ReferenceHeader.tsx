import { ArrowUpRight, ChevronDown } from "lucide-react";
import catalog from "@/lib/reference-catalog.json";
import type { ReferencePackage } from "@/lib/reference";

const packages = catalog.packages as ReferencePackage[];

/** Where a release's own source lives. */
function sourceLabel(url: string) {
  return url.includes("github.com") ? "Source" : "npm";
}

/**
 * Version switcher and provenance for a generated reference page. Rendered by
 * `scripts/reference/pages.mjs`, which also precomputes each release's `href`.
 */
export function ReferenceHeader({
  packageId,
  version,
}: {
  packageId: string;
  version: string;
}) {
  const pkg = packages.find((item) => item.id === packageId);
  if (!pkg) return null;
  const current = pkg.versions.find((item) => item.version === version);
  if (!current) return null;

  return (
    <div className="sp-ref-header">
      <div className="sp-ref-header__row">
        <details className="sp-ref-version group">
          <summary className="sp-ref-version__summary">
            <span className="sp-ref-version__current">{version}</span>
            <ChevronDown aria-hidden className="sp-ref-version__chevron" />
          </summary>
          <div className="sp-ref-version__menu">
            {pkg.versions.map((release) => (
              <a
                key={release.version}
                href={release.href}
                aria-current={release.version === version ? "page" : undefined}
                title={release.unavailable}
                className={`sp-ref-version__item${
                  release.version === version
                    ? " sp-ref-version__item--current"
                    : ""
                }${release.onSite ? "" : " sp-ref-version__item--external"}`}
              >
                {release.version}
                {release.onSite ? "" : " ↗"}
              </a>
            ))}
          </div>
        </details>

        <a
          href={current.url}
          target="_blank"
          rel="noreferrer noopener"
          className="sp-ref-source"
        >
          {sourceLabel(current.url)}
          <ArrowUpRight aria-hidden />
        </a>
      </div>

      {current.unpublished || current.data ? (
        <p className="sp-ref-note">
          {current.unpublished
            ? "Generated from a pinned source commit, not a published npm release. This snapshot is deliberately pinned rather than following the branch."
            : "Generated from the published type declarations for this exact release."}
        </p>
      ) : null}
    </div>
  );
}

export default ReferenceHeader;
