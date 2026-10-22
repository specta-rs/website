export interface ReferenceSymbol {
  name: string;
  kind: string;
  description: string;
  signature?: string;
  url: string;
  sourceUrl?: string;
}

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
  versions: ReferenceVersion[];
}

export interface ReferenceData {
  symbols: ReferenceSymbol[];
  description?: string;
}

export const projectNames = {
  specta: "Specta",
  rspc: "rspc",
  "tauri-specta": "Tauri Specta",
};

export function symbolAnchor(symbol: ReferenceSymbol): string {
  return symbol.url.split("#")[1] || encodeURIComponent(symbol.name);
}

export function filterSymbols(symbols: ReferenceSymbol[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return symbols.filter((symbol) =>
    terms.every((term) =>
      `${symbol.name} ${symbol.kind} ${symbol.description} ${symbol.signature || ""}`
        .toLowerCase()
        .includes(term),
    ),
  );
}

export function selectedSymbol(
  symbols: ReferenceSymbol[],
  query: string,
  hash: string,
) {
  return (
    symbols.find((symbol) => symbolAnchor(symbol) === hash) ||
    filterSymbols(symbols, query)[0]
  );
}
