export interface ReferenceVersion {
  version: string;
  /** Where this release's source lives. */
  url: string;
  /** Set when the release has symbols in `reference/`. */
  data?: string;
  unavailable?: string;
  /** Resolved link for the version switcher: a page here, or its source. */
  href: string;
  /** Whether `href` is a page on this site. */
  onSite: boolean;
  /** Symbols came from a pinned source commit, not a published archive. */
  unpublished?: boolean;
}

export interface ReferencePackage {
  id: string;
  name: string;
  language: string;
  /** Project whose sidebar holds this package's reference. */
  project: string;
  /** Newest release published to the registry, which may have no symbols. */
  defaultVersion: string;
  /** Release documented at the package's own URL. */
  homeVersion: string;
  versions: ReferenceVersion[];
}
