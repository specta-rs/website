import { ArrowRight, TriangleAlert } from "lucide-react";

/**
 * Rendered on rspc documentation. The whole project is unmaintained, so every
 * rspc page carries the notice; the 0.3.0 release gets a stronger message and
 * a link to the latest docs. On the 0.3.0 pages it also pairs with the noindex
 * meta tag to keep the legacy pages out of search results.
 */
export function DeprecationBanner({ legacy = false }: { legacy?: boolean }) {
  return (
    <div className="sp-deprecation" role="note">
      <TriangleAlert aria-hidden className="sp-deprecation__icon" />
      {legacy ? (
        <p className="sp-deprecation__text">
          <strong>This documentation is deprecated.</strong> It covers rspc{" "}
          <code>0.3.0</code>, which is no longer maintained.
        </p>
      ) : (
        <p className="sp-deprecation__text">
          <strong>rspc is no longer maintained.</strong> These docs are kept for
          reference.
        </p>
      )}
      {legacy ? (
        <a className="sp-deprecation__action" href="/docs/rspc/1.0.0-rc.x">
          Read the latest docs
          <ArrowRight aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
