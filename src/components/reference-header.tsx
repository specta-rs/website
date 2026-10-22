import { ArrowUpRight } from "lucide-react";
import catalog from "@/lib/reference-catalog.json";
import type { ReferencePackage } from "@/lib/reference";

const packages = catalog.packages as ReferencePackage[];

function packageUrl(pkg: ReferencePackage, version: string) {
  const base = `/docs/${pkg.project}/typescript-api/${pkg.id}`;
  return version === pkg.homeVersion ? base : `${base}/${version}`;
}

/** Where a release's own source lives. */
function sourceLabel(url: string) {
  return url.includes("github.com") ? "Source" : "npm";
}

/**
 * Version switcher and provenance for a generated reference page. Rendered by
 * `scripts/reference/pages.mjs`, so the package and version are the only inputs.
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
  const unpublished = version.startsWith("unreleased-");

  return (
    <div className="not-prose my-6 flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <details className="group relative min-w-40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border bg-fd-secondary/50 px-3 py-1.5 font-medium transition-colors hover:bg-fd-accent">
            <span className="truncate">
              {version}
              {current.yanked ? " (yanked)" : ""}
            </span>
            <span
              aria-hidden
              className="text-fd-muted-foreground transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="absolute z-20 mt-1 max-h-80 w-56 overflow-y-auto rounded-lg border bg-fd-popover p-1 shadow-lg">
            {pkg.versions.map((release) => {
              // The page version is always on this site; other releases only
              // when their declarations could be extracted.
              const onSite =
                release.data || release.version === pkg.homeVersion;
              return (
                <a
                  key={release.version}
                  href={onSite ? packageUrl(pkg, release.version) : release.url}
                  aria-current={
                    release.version === version ? "page" : undefined
                  }
                  title={release.unavailable}
                  className={`block rounded-md px-2.5 py-1.5 font-mono text-xs ${
                    release.version === version
                      ? "bg-fd-accent font-semibold text-fd-accent-foreground"
                      : "hover:bg-fd-accent"
                  } ${onSite ? "" : "text-fd-muted-foreground"}`}
                >
                  {release.version}
                  {release.yanked ? " (yanked)" : ""}
                  {onSite ? "" : " ↗"}
                </a>
              );
            })}
          </div>
        </details>

        <a
          href={current.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium transition-colors hover:bg-fd-accent"
        >
          {sourceLabel(current.url)}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      <p className="text-fd-muted-foreground">
        Generated from the published type declarations for this exact release.
        {unpublished
          ? " This release is unpublished: the snapshot is pinned to a source commit and is not an npm version."
          : ""}
      </p>
    </div>
  );
}
