import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const records = [];
const packages = [];
for (const ecosystem of ["rust", "typescript"]) {
  const catalog = JSON.parse(
    await readFile(new URL(`public/reference/${ecosystem}.json`, root), "utf8"),
  );
  packages.push(...catalog.packages);
  for (const pkg of catalog.packages) {
    const release = pkg.versions.find(
      (item) => item.version === pkg.defaultVersion,
    );
    if (!release?.data) continue;
    const artifact = JSON.parse(
      await readFile(new URL(`public${release.data}`, root), "utf8"),
    );
    for (const symbol of artifact.symbols) {
      records.push({
        name: symbol.name,
        url: symbol.url,
        package: pkg.name,
        version: release.version,
        language: pkg.language,
        text: `${symbol.kind} ${symbol.description || ""} ${symbol.signature || ""}`.slice(
          0,
          3000,
        ),
      });
    }
  }
}
const target = new URL("src/lib/reference-index.json", root);
await writeFile(target, `${JSON.stringify(records)}\n`);
await writeFile(
  new URL("src/lib/reference-catalog.json", root),
  `${JSON.stringify({ packages })}\n`,
);
console.log(
  `Indexed ${records.length} default-version API symbols in ${fileURLToPath(target)}`,
);
