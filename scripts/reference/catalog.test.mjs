import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function catalog() {
  const { packages } = JSON.parse(
    await readFile(new URL("reference/typescript.json", root), "utf8"),
  );
  return packages;
}

test("reference catalog has usable, version-correct artifacts", async () => {
  const packages = await catalog();
  assert.ok(packages.length > 0);
  assert.equal(new Set(packages.map((pkg) => pkg.id)).size, packages.length);
  for (const pkg of packages) {
    assert.equal(pkg.project, "rspc");
    assert.equal(pkg.language, "typescript");
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
      assert.equal(
        release.data,
        `reference/typescript/${pkg.id}/${release.version}.json`,
      );
      const data = JSON.parse(
        await readFile(new URL(release.data, root), "utf8"),
      );
      assert.ok(
        data.symbols.length > 0,
        `${pkg.id}@${release.version}: empty artifact`,
      );
      assert.equal(
        new Set(data.symbols.map((symbol) => `${symbol.kind}:${symbol.name}`))
          .size,
        data.symbols.length,
        `${pkg.id}@${release.version}: duplicate symbols`,
      );
      for (const symbol of data.symbols) {
        assert.ok(symbol.name && symbol.kind);
        assert.ok(symbol.signature);
        assert.match(symbol.sourceUrl, /^https:\/\//, symbol.sourceUrl);
      }
    }
  }
});

test("bundled catalog mirrors the version metadata the pages are built from", async () => {
  const packages = await catalog();
  const bundled = JSON.parse(
    await readFile(new URL("src/lib/reference-catalog.json", root), "utf8"),
  );
  // The switcher only needs release metadata, but it must not drift from the
  // catalog the pages are generated from.
  assert.deepEqual(
    bundled.packages.map((pkg) => pkg.id),
    packages.map((pkg) => pkg.id),
  );
  for (const [index, pkg] of packages.entries()) {
    const built = bundled.packages[index];
    assert.equal(built.name, pkg.name);
    assert.equal(built.project, pkg.project);
    assert.equal(built.defaultVersion, pkg.defaultVersion);
    assert.deepEqual(built.versions, pkg.versions);
  }
});
