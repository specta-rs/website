import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../public/", import.meta.url);

for (const ecosystem of ["rust", "typescript"]) {
  test(`${ecosystem} reference catalog has usable, version-correct artifacts`, async () => {
    const { packages } = JSON.parse(
      await readFile(new URL(`reference/${ecosystem}.json`, root), "utf8"),
    );
    assert.ok(packages.length > 0);
    assert.equal(new Set(packages.map((pkg) => pkg.id)).size, packages.length);
    for (const pkg of packages) {
      assert.ok(
        pkg.versions.some((release) => release.version === pkg.defaultVersion),
        pkg.id,
      );
      assert.equal(
        new Set(pkg.versions.map((release) => release.version)).size,
        pkg.versions.length,
        pkg.id,
      );
      for (const release of pkg.versions) {
        assert.ok(
          release.url.startsWith("https://"),
          `${pkg.id}@${release.version}: source URL`,
        );
        if (!release.data) {
          assert.ok(
            release.unavailable,
            `${pkg.id}@${release.version}: missing availability reason`,
          );
          continue;
        }
        assert.ok(release.data.startsWith(`/reference/${ecosystem}/`));
        const data = JSON.parse(
          await readFile(new URL(release.data.slice(1), root), "utf8"),
        );
        assert.ok(
          data.symbols.length > 0,
          `${pkg.id}@${release.version}: empty artifact`,
        );
        assert.equal(
          new Set(data.symbols.map((symbol) => `${symbol.name}:${symbol.url}`))
            .size,
          data.symbols.length,
          `${pkg.id}@${release.version}: duplicate symbols`,
        );
        for (const symbol of data.symbols) {
          assert.ok(symbol.name && symbol.kind && symbol.url);
          if (ecosystem === "rust") {
            const url = new URL(symbol.url);
            assert.equal(url.origin, "https://docs.rs");
            assert.ok(
              url.pathname.includes(`/${release.version}/`),
              symbol.url,
            );
          } else {
            const url = new URL(symbol.url, "https://specta.dev");
            assert.equal(url.pathname, "/docs/reference");
            assert.equal(url.searchParams.get("package"), pkg.id);
            assert.equal(url.searchParams.get("version"), release.version);
            assert.ok(url.hash, symbol.url);
          }
        }
      }
    }
  });
}

test("bundled catalog and default-version search index match the release snapshots", async () => {
  const packages = [];
  const records = [];
  for (const ecosystem of ["rust", "typescript"]) {
    const catalog = JSON.parse(
      await readFile(new URL(`reference/${ecosystem}.json`, root), "utf8"),
    );
    packages.push(...catalog.packages);
    for (const pkg of catalog.packages) {
      const release = pkg.versions.find(
        (item) => item.version === pkg.defaultVersion,
      );
      if (!release?.data) continue;
      const artifact = JSON.parse(
        await readFile(new URL(release.data.slice(1), root), "utf8"),
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
  assert.deepEqual(
    JSON.parse(
      await readFile(
        new URL("../../src/lib/reference-catalog.json", import.meta.url),
        "utf8",
      ),
    ),
    { packages },
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        new URL("../../src/lib/reference-index.json", import.meta.url),
        "utf8",
      ),
    ),
    records,
  );
});
