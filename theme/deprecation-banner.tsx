import { ArrowRight, TriangleAlert } from "lucide-react";

/**
 * Rendered on documentation that covers a deprecated release. It links readers
 * to the current docs and, together with the noindex meta tag, keeps the
 * legacy pages out of search engine results.
 */
export function DeprecationBanner() {
  return (
    <div className="sp-deprecation" role="note">
      <TriangleAlert aria-hidden className="sp-deprecation__icon" />
      <p className="sp-deprecation__text">
        <strong>This documentation is deprecated.</strong> It covers rspc{" "}
        <code>0.3.0</code>, which is no longer maintained.
      </p>
      <a className="sp-deprecation__action" href="/docs/rspc/1.0.0-rc.x">
        Read the latest docs
        <ArrowRight aria-hidden />
      </a>
    </div>
  );
}
