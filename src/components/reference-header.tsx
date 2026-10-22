import { ArrowUpRight } from "lucide-react";
import catalog from "@/lib/reference-catalog.json";
import type { ReferencePackage } from "@/lib/reference";

const packages = catalog.packages as ReferencePackage[];

const languageFolder = {
  rust: "rust-api",
  typescript: "typescript-api",
} as const;

function packageUrl(pkg: ReferencePackage, version: string) {
  const base = `/docs/${pkg.project}/${languageFolder[pkg.language]}/${pkg.id}`;
  return version === pkg.homeVersion ? base : `${base}/${version}`;
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
  const isRust = pkg.language === "rust";
  const unpublished = version.startsWith("unreleased-");
  const generated = pkg.project === "tauri-specta";

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
            {pkg.versions.map((release) => (
              <a
                key={release.version}
                href={
                  release.data ? packageUrl(pkg, release.version) : release.url
                }
                aria-current={release.version === version ? "page" : undefined}
                title={release.unavailable}
                className={`block rounded-md px-2.5 py-1.5 font-mono text-xs ${
                  release.version === version
                    ? "bg-fd-accent font-semibold text-fd-accent-foreground"
                    : "hover:bg-fd-accent"
                } ${release.data ? "" : "text-fd-muted-foreground"}`}
              >
                {release.version}
                {release.version === pkg.homeVersion ? " (default)" : ""}
                {release.yanked ? " (yanked)" : ""}
                {release.data ? "" : " ↗"}
              </a>
            ))}
          </div>
        </details>

        <a
          href={current.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium transition-colors hover:bg-fd-accent"
        >
          {isRust ? "docs.rs" : generated ? "Release source" : "npm"}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      <p className="text-fd-muted-foreground">
        {isRust
          ? "Generated from the docs.rs rustdoc build for this exact release, so signatures are previews rather than full declarations."
          : "Generated from the published type declarations for this exact release."}
        {unpublished
          ? " This release is unpublished: the snapshot is pinned to a source commit and is not an npm version."
          : ""}
        {generated
          ? " These are representative generated bindings, so names and signatures depend on the Rust application they came from."
          : ""}
      </p>
    </div>
  );
}
