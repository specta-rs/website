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
  project: "specta" | "rspc" | "tauri-specta";
  language: "rust" | "typescript";
  defaultVersion: string;
  /** Version documented at the package's own URL. */
  homeVersion: string;
  versions: ReferenceVersion[];
}
