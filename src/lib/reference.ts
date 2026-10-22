export interface ReferenceVersion {
  version: string;
  url: string;
  data?: string;
  unavailable?: string;
  yanked?: boolean;
}

export interface ReferencePackage {
  id: string;
  name: string;
  /** Project whose sidebar holds this package's reference. */
  project: string;
  defaultVersion: string;
  /** Version documented at the package's own URL. */
  homeVersion: string;
  versions: ReferenceVersion[];
}
