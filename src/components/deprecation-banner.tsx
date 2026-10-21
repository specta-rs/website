import { TriangleAlert } from "lucide-react";
import { Link } from "waku";

// Rendered on documentation that covers a deprecated release (see
// `isDeprecatedPage` in `@/lib/source`). It links readers to the current docs
// and, together with the `noindex` meta tag, keeps the legacy pages out of
// search engine results.
export function DeprecationBanner() {
  return (
    <div className="not-prose mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <p className="text-fd-muted-foreground">
          <span className="font-medium text-fd-foreground">
            This documentation is deprecated.
          </span>{" "}
          It covers rspc <code>0.3.0</code>, which is no longer maintained.
        </p>
      </div>
      <Link
        to="/docs/rspc/1.0.0-rc.x"
        className="w-fit shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-fd-foreground transition-colors hover:bg-amber-500/25"
      >
        Read the latest docs
      </Link>
    </div>
  );
}
