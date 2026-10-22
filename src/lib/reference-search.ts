export interface ReferenceSearchRecord {
  name: string;
  url: string;
  package: string;
  version: string;
  language: string;
  text: string;
}

export function searchReference(
  records: ReferenceSearchRecord[],
  query: string,
  limit = 12,
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return records
    .map((record) => {
      const name = record.name.toLowerCase();
      const text = `${name} ${record.package} ${record.text}`.toLowerCase();
      if (!terms.every((term) => text.includes(term))) return null;
      const score =
        name === query.trim().toLowerCase()
          ? 3
          : terms.every((term) => name.includes(term))
            ? 2
            : 1;
      return { record, score };
    })
    .filter((item) => item !== null)
    .toSorted(
      (a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name),
    )
    .slice(0, limit)
    .map(({ record }) => ({
      id: `api:${record.url}`,
      type: "page" as const,
      content: record.name,
      url: record.url,
      external: record.url.startsWith("https://docs.rs/"),
      breadcrumbs: [
        "API reference",
        `${record.language === "rust" ? "Rust" : "TypeScript"} · ${record.package} · ${record.version}`,
      ],
    }));
}
