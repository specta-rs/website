import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  escapeMdx,
  groupSymbols,
  homeVersion,
  pageUrl,
  renderPackagePage,
} from "./pages.mjs";

const root = path.resolve(import.meta.dirname, "../..");

const rustPackage = {
  id: "rust-example",
  name: "example",
  project: "specta",
  language: "rust",
  defaultVersion: "1.0.0",
  versions: [
    { version: "1.0.0", url: "https://docs.rs/example/1.0.0/example/" },
    { version: "0.9.0", url: "https://docs.rs/example/0.9.0/example/" },
  ],
};

test("MDX escaping neutralises markup without losing prose", () => {
  assert.equal(
    escapeMdx("Returns {a} <b> where `x: i32` is set."),
    "Returns &#123;a&#125; &#60;b&#62; where `x: i32` is set.",
  );
  assert.equal(escapeMdx("## not a heading"), "\\## not a heading");
  assert.equal(escapeMdx("line one\nline two"), "line one\nline two");
  assert.equal(escapeMdx(undefined), "");
});

test("a release without data still selects the newest documented version", () => {
  const pkg = {
    ...rustPackage,
    defaultVersion: "0.9.0",
    versions: [
      { version: "0.9.0", url: "https://docs.rs/example/0.9.0/example/" },
      {
        version: "0.8.0",
        url: "https://docs.rs/example/0.8.0/example/",
        data: "reference/rust/rust-example/0.8.0.json",
      },
    ],
  };
  assert.equal(homeVersion(pkg), "0.8.0");
  assert.equal(homeVersion(rustPackage), "1.0.0");
});

test("signatures render as lightweight code, not highlighted blocks", () => {
  const single = renderPackagePage({
    pkg: rustPackage,
    version: "1.0.0",
    artifact: {
      symbols: [
        {
          name: "collect",
          kind: "fn",
          description: "",
          signature: "pub fn collect() -> Types",
          url: "https://docs.rs/example/1.0.0/example/fn.collect.html",
        },
      ],
    },
  });
  // Inline code keeps hundreds of symbols on one page affordable.
  assert.match(single, /\n`pub fn collect\(\) -> Types`\n/);
  assert.ok(!single.includes("```"));
  const multiline = renderPackagePage({
    pkg: { ...rustPackage, language: "typescript" },
    version: "1.0.0",
    artifact: {
      symbols: [
        {
          name: "createClient",
          kind: "function",
          description: "",
          signature: "type A = `x${string}`;\nfunction f(): void;",
        },
      ],
    },
  });
  // Multi-line (or backtick-bearing) declarations keep their layout without
  // pulling in a highlighted block.
  assert.match(
    multiline,
    /<pre className="[^"]*">\{"type A = `x\$\{string\}`;\\nfunction f\(\): void;"\}<\/pre>/,
  );
});

test("symbols are grouped into documented sections and ordered", () => {
  const groups = groupSymbols(
    [
      { name: "b::Thing", kind: "struct" },
      { name: "b::other", kind: "fn" },
      { name: "b::odd", kind: "mystery" },
    ],
    "rust",
  );
  assert.deepEqual(
    groups.map((group) => group.title),
    ["Structs", "Functions", "Other"],
  );
  assert.deepEqual(
    groups[2].symbols.map((symbol) => symbol.name),
    ["b::odd"],
  );
});

test("the default version owns the package URL", () => {
  assert.equal(
    pageUrl(rustPackage, "1.0.0"),
    "/docs/specta/rust-api/rust-example",
  );
  assert.equal(
    pageUrl(rustPackage, "0.9.0"),
    "/docs/specta/rust-api/rust-example/0.9.0",
  );
});

test("a package page carries its version switcher, sections and anchors", () => {
  const page = renderPackagePage({
    pkg: rustPackage,
    version: "0.9.0",
    artifact: {
      symbols: [
        {
          name: "collect",
          kind: "fn",
          description: "Collects {types}.",
          signature: "pub fn collect() -> Types",
          url: "https://docs.rs/example/0.9.0/example/fn.collect.html",
        },
        {
          name: "Thing",
          kind: "struct",
          description: "A thing.",
          url: "https://docs.rs/example/0.9.0/example/struct.Thing.html",
        },
      ],
    },
  });
  assert.match(page, /^---\ntitle: "example"/);
  assert.match(page, /\ngenerated: true\nhidden: true\n/);
  assert.match(
    page,
    /<ReferenceHeader packageId="rust-example" version="0\.9\.0" \/>/,
  );
  assert.match(page, /## Structs\n/);
  assert.match(page, /## Functions\n/);
  assert.match(
    page,
    /### \[`collect`\]\(https:\/\/docs\.rs\/example\/0\.9\.0\/example\/fn\.collect\.html\)/,
  );
  assert.match(page, /\n`pub fn collect\(\) -> Types`\n/);
  assert.match(page, /Collects &#123;types&#125;\./);
  assert.match(
    page,
    /\[documented version\]\(\/docs\/specta\/rust-api\/rust-example\)/,
  );
});

test("a package without extractable documentation still gets an explaining page", () => {
  const page = renderPackagePage({
    pkg: {
      ...rustPackage,
      defaultVersion: "0.9.0",
      versions: [
        {
          version: "0.9.0",
          url: "https://docs.rs/example/0.9.0/example/",
          unavailable:
            "docs.rs could not build documentation for this release.",
        },
      ],
    },
    version: "0.9.0",
    artifact: undefined,
  });
  assert.match(page, /No API documentation could be extracted for example\./);
  assert.match(page, /docs\.rs could not build documentation/);
  assert.match(page, /\ngenerated: true\n---\n/);
  assert.match(
    page,
    /<ReferenceHeader packageId="rust-example" version="0\.9\.0" \/>/,
  );
});

test("the default version page is not hidden", () => {
  const page = renderPackagePage({
    pkg: rustPackage,
    version: "1.0.0",
    artifact: {
      symbols: [
        {
          name: "collect",
          kind: "fn",
          description: "",
          url: "https://docs.rs/example/1.0.0/example/fn.collect.html",
        },
      ],
    },
  });
  assert.match(page, /\ngenerated: true\n---\n/);
  assert.ok(!page.includes("hidden: true"));
});

const read = async (relative) => readFile(path.join(root, relative), "utf8");

test("generated pages land in the docs tree with only the default listed", async () => {
  const specta = await read(
    "content/docs/specta/rust-api/rust-specta/index.mdx",
  );
  assert.match(specta, /^---\ntitle: "specta"/);
  assert.match(specta, /<ReferenceHeader packageId="rust-specta"/);
  const meta = JSON.parse(await read("content/docs/specta/rust-api/meta.json"));
  assert.equal(meta.title, "Rust API");
  assert.ok(meta.pages.includes("rust-specta"));
  const scoped = JSON.parse(
    await read("content/docs/specta/rust-api/rust-specta/meta.json"),
  );
  assert.deepEqual(scoped, {
    title: "specta",
    collapsible: false,
    pages: [],
  });
  const older = await read(
    "content/docs/specta/rust-api/rust-specta/2.0.0-rc.26.mdx",
  );
  assert.match(older, /\nhidden: true\n/);
  assert.match(
    older,
    /<ReferenceHeader packageId="rust-specta" version="2\.0\.0-rc\.26"/,
  );
  const typescript = await read(
    "content/docs/rspc/typescript-api/ts-rspc-client/index.mdx",
  );
  assert.match(typescript, /^---\ntitle: "@rspc\/client"/);
  assert.match(typescript, /\n### `createClient`\n/);
  const bindings = await read(
    "content/docs/tauri-specta/typescript-api/ts-tauri-specta/index.mdx",
  );
  assert.match(bindings, /^---\ntitle: "Generated bindings"/);
  assert.match(bindings, /\n### `[^`]*commands\.plainError`\n/);
  // Every package in the catalog has a page and a place in the sidebar.
  const bundled = JSON.parse(await read("src/lib/reference-catalog.json"));
  for (const pkg of bundled.packages) {
    const folder = `content/docs/${pkg.project}/${
      pkg.language === "rust" ? "rust-api" : "typescript-api"
    }`;
    const sidebar = JSON.parse(await read(`${folder}/meta.json`));
    assert.ok(sidebar.pages.includes(pkg.id), `${pkg.id} missing from sidebar`);
    assert.match(
      await read(`${folder}/${pkg.id}/index.mdx`),
      new RegExp(`version="${pkg.homeVersion.replace(/\./g, "\\.")}"`),
    );
  }
});
