import { usePage } from "@rspress/core/runtime";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

const labels: Record<string, string> = {
  "rspc/1.0.0-rc.x": "1.0.0-rc.x (alpha)",
  "rspc/0.3.0": "0.3.0 (deprecated)",
  "rspc/typescript-api": "TypeScript API",
  "rspc/0.3.0/client": "Client",
  "rspc/0.3.0/server": "Server",
  "rspc/0.3.0/integrations": "Integrations",
  "rspc/0.3.0/ecosystem": "Ecosystem",
  "rspc/0.3.0/alpha": "Alpha (1.0.0-rc.x)",
  "rspc/0.3.0/alpha/server": "Server",
};

/**
 * The folder trail above a page title. It mirrors the old DocsPage breadcrumb:
 * only folders below the project root, with the flattened 1.0.0-rc.x chapter
 * shown as a single entry.
 */
export function Breadcrumb() {
  const { page } = usePage();
  const relative = page.pagePath
    .replace(/^docs\//, "")
    .replace(/\/index\.mdx$/, "")
    .replace(/\.mdx$/, "");
  const segments = relative.split("/");
  const project = segments[0];
  const isIndex = page.pagePath.endsWith("/index.mdx");
  const folders = isIndex ? segments.slice(1) : segments.slice(1, -1);

  if (folders.length === 0) return null;

  let trail = folders.map(
    (_, index) =>
      labels[`${project}/${folders.slice(0, index + 1).join("/")}`] ??
      folders[index],
  );

  // `server/`, `client/` and the rest of the experimental rewrite are flattened
  // under 1.0.0-rc.x in the sidebar, so they are not a separate breadcrumb.
  if (project === "rspc" && folders[0] === "1.0.0-rc.x") {
    trail = [labels["rspc/1.0.0-rc.x"]];
  }

  // The generated package page is itself the folder link; the old breadcrumb
  // stopped at the TypeScript API group.
  if (project === "rspc" && folders[0] === "typescript-api") {
    trail = [labels["rspc/typescript-api"]];
  }

  return (
    <div className="mb-2 flex items-center gap-1.5 text-sm text-fd-muted-foreground">
      {trail.map((label, index) => (
        <Fragment key={`${index}-${label}`}>
          {index > 0 ? <ChevronRight className="size-3.5 shrink-0" /> : null}
          <span
            className={
              index === trail.length - 1
                ? "truncate font-medium text-fd-primary"
                : "truncate"
            }
          >
            {label}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
