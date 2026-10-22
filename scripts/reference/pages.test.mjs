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
  truncateSignature,
} from "./pages.mjs";

const root = path.resolve(import.meta.dirname, "../..");

const examplePackage = {
  id: "ts-example",
  name: "@rspc/example",
  project: "rspc",
  defaultVersion: "1.0.0",
  versions: [
    {
      version: "1.0.0",
      url: "https://www.npmjs.com/package/@rspc/example/v/1.0.0",
    },
    {
      version: "0.9.0",
      url: "https://www.npmjs.com/package/@rspc/example/v/0.9.0",
    },
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

test("escaping leaves inline code spans alone", () => {
  assert.equal(
    escapeMdx("Use `createSolidQueryHooks<Procedures>()` here."),
    "Use `createSolidQueryHooks<Procedures>()` here.",
  );
  assert.equal(
    escapeMdx("Braces { and code `a < b` stay apart."),
    "Braces &#123; and code `a < b` stay apart.",
  );
});

test("a release without data still selects the newest documented version", () => {
  const pkg = {
    ...examplePackage,
    defaultVersion: "0.9.0",
    versions: [
      {
        version: "0.9.0",
        url: "https://www.npmjs.com/package/@rspc/example/v/0.9.0",
      },
      {
        version: "0.8.0",
        url: "https://www.npmjs.com/package/@rspc/example/v/0.8.0",
        data: "reference/typescript/ts-example/0.8.0.json",
      },
    ],
  };
  assert.equal(homeVersion(pkg), "0.8.0");
  assert.equal(homeVersion(examplePackage), "1.0.0");
});

test("long declarations are trimmed at a line boundary, never emptied", () => {
  assert.equal(truncateSignature("type A = string;"), "type A = string;");
  const single = `type Long = ${"a".repeat(1200)};`;
  assert.equal(truncateSignature(single), single);
  const multi = Array.from(
    { length: 40 },
    (_, i) => `  member_${i}(${"x".repeat(40)}): Result;`,
  ).join("\n");
  const trimmed = truncateSignature(multi);
  assert.match(trimmed, /^ {2}member_0\(/);
  assert.match(trimmed, /\n\/\/ … truncated, see the source link$/);
  assert.ok(trimmed.length < multi.length);
});

test("an unpublished snapshot's provenance is stated once per page", () => {
  const commit = "b".repeat(40);
  const page = renderPackagePage({
    pkg: examplePackage,
    version: "1.0.0",
    artifact: {
      published: false,
      sourceCommit: commit,
      description: `Unreleased source snapshot of packages/tanstack-query at commit ${commit}; not a published npm version. The directory is documented as @rspc/tanstack-query.`,
      symbols: [
        {
          name: "createHooks",
          kind: "function",
          description: `Unreleased source snapshot of packages/tanstack-query at commit ${commit}; not a published npm version. The directory is documented as @rspc/tanstack-query. Wraps the query client.`,
          signature: "declare function createHooks(): Hooks;",
        },
        {
          name: "silent",
          kind: "function",
          description: `Unreleased source snapshot of packages/tanstack-query at commit ${commit}; not a published npm version.`,
          signature: "declare function silent(): void;",
        },
      ],
    },
  });
  // The page states the snapshot once; symbols keep only their own docs, with
  // no dangling fragment left behind.
  assert.equal(page.split("not a published npm version.").length - 1, 1);
  assert.match(page, /Wraps the query client\./);
  assert.match(
    page,
    /### `silent`\n\n`declare function silent\(\): void;`\n\n$/,
  );
});

test("signatures render as lightweight code, not highlighted blocks", () => {
  const single = renderPackagePage({
    pkg: examplePackage,
    version: "1.0.0",
    artifact: {
      symbols: [
        {
          name: "createClient",
          kind: "function",
          description: "",
          signature: "declare function createClient(): Client;",
        },
      ],
    },
  });
  // Inline code keeps hundreds of symbols on one page affordable.
  assert.match(single, /\n`declare function createClient\(\): Client;`\n/);
  assert.ok(!single.includes("```"));
  const multiline = renderPackagePage({
    pkg: examplePackage,
    version: "1.0.0",
    artifact: {
      symbols: [
        {
          name: "Client",
          kind: "class",
          description: "",
          signature: "type A = `x${string}`;\ndeclare class Client {}",
        },
      ],
    },
  });
  // Multi-line (or backtick-bearing) declarations keep their layout without
  // pulling in a highlighted block.
  assert.match(
    multiline,
    /<pre className="[^"]*">\{"type A = `x\$\{string\}`;\\ndeclare class Client \{\}"\}<\/pre>/,
  );
});

test("symbols are grouped into documented sections and ordered", () => {
  const groups = groupSymbols([
    { name: "b.Thing", kind: "class" },
    { name: "b.other", kind: "function" },
    { name: "b.odd", kind: "mystery" },
  ]);
  assert.deepEqual(
    groups.map((group) => group.title),
    ["Classes", "Functions", "Other"],
  );
  assert.deepEqual(
    groups[2].symbols.map((symbol) => symbol.name),
    ["b.odd"],
  );
});

test("the documented version owns the package URL", () => {
  assert.equal(
    pageUrl(examplePackage, "1.0.0"),
    "/docs/rspc/typescript-api/ts-example",
  );
  assert.equal(
    pageUrl(examplePackage, "0.9.0"),
    "/docs/rspc/typescript-api/ts-example/0.9.0",
  );
});

test("a package page carries its version switcher, sections and source links", () => {
  const page = renderPackagePage({
    pkg: examplePackage,
    version: "0.9.0",
    artifact: {
      symbols: [
        {
          name: "createClient",
          kind: "function",
          description: "Creates a {typed} client.",
          signature: "declare function createClient(): Client;",
          sourceUrl: "https://www.npmjs.com/package/@rspc/example/v/0.9.0",
        },
        {
          name: "Client",
          kind: "interface",
          description: "A client.",
          signature: "interface Client {}",
          sourceUrl: "https://www.npmjs.com/package/@rspc/example/v/0.9.0",
        },
      ],
    },
  });
  assert.match(page, /^---\ntitle: "@rspc\/example"/);
  assert.match(page, /\ngenerated: true\nhidden: true\n/);
  assert.match(
    page,
    /<ReferenceHeader packageId="ts-example" version="0\.9\.0" \/>/,
  );
  assert.match(page, /## Interfaces\n/);
  assert.match(page, /## Functions\n/);
  assert.match(page, /\n### `createClient`\n/);
  assert.match(page, /Creates a &#123;typed&#125; client\./);
  assert.match(page, /\[View source ↗\]\(https:\/\/www\.npmjs\.com/);
  assert.match(
    page,
    /\[documented version\]\(\/docs\/rspc\/typescript-api\/ts-example\)/,
  );
});

test("a package without extractable documentation still gets an explaining page", () => {
  const page = renderPackagePage({
    pkg: {
      ...examplePackage,
      defaultVersion: "0.9.0",
      versions: [
        {
          version: "0.9.0",
          url: "https://www.npmjs.com/package/@rspc/example/v/0.9.0",
          unavailable: "The published npm archive has no declaration file.",
        },
      ],
    },
    version: "0.9.0",
    artifact: undefined,
  });
  assert.match(
    page,
    /No API documentation could be extracted for @rspc\/example\./,
  );
  assert.match(page, /no declaration file/);
  assert.match(page, /\ngenerated: true\n---\n/);
  assert.match(
    page,
    /<ReferenceHeader packageId="ts-example" version="0\.9\.0" \/>/,
  );
});

test("the documented version page is not hidden", () => {
  const page = renderPackagePage({
    pkg: examplePackage,
    version: "1.0.0",
    artifact: {
      symbols: [
        {
          name: "createClient",
          kind: "function",
          description: "",
          signature: "declare function createClient(): Client;",
        },
      ],
    },
  });
  assert.match(page, /\ngenerated: true\n---\n/);
  assert.ok(!page.includes("hidden: true"));
});

const read = async (relative) => readFile(path.join(root, relative), "utf8");

test("generated pages sit under rspc's sidebar with only the documented version listed", async () => {
  const client = await read(
    "content/docs/rspc/typescript-api/ts-rspc-client/index.mdx",
  );
  assert.match(client, /^---\ntitle: "@rspc\/client"/);
  assert.match(client, /\n### `createClient`\n/);
  const meta = JSON.parse(
    await read("content/docs/rspc/typescript-api/meta.json"),
  );
  assert.equal(meta.title, "TypeScript API");
  assert.ok(meta.pages.includes("ts-rspc-client"));
  const scoped = JSON.parse(
    await read("content/docs/rspc/typescript-api/ts-rspc-client/meta.json"),
  );
  assert.deepEqual(scoped, {
    title: "@rspc/client",
    collapsible: false,
    pages: [],
  });
  const older = await read(
    "content/docs/rspc/typescript-api/ts-rspc-client/0.2.4.mdx",
  );
  assert.match(older, /\nhidden: true\n/);
  assert.match(
    older,
    /<ReferenceHeader packageId="ts-rspc-client" version="0\.2\.4"/,
  );
  // Dropped work must not leave pages or sidebar entries behind.
  for (const gone of [
    "content/docs/specta/rust-api",
    "content/docs/rspc/rust-api",
    "content/docs/tauri-specta/rust-api",
    "content/docs/tauri-specta/typescript-api",
  ]) {
    await assert.rejects(read(`${gone}/meta.json`), /ENOENT/);
  }
  // Every package in the catalog has a page and a place in the sidebar.
  const bundled = JSON.parse(await read("src/lib/reference-catalog.json"));
  const sidebar = JSON.parse(
    await read("content/docs/rspc/typescript-api/meta.json"),
  );
  assert.deepEqual(
    [...sidebar.pages].toSorted(),
    bundled.packages.map((pkg) => pkg.id).toSorted(),
  );
  // Pinned by name, so swapping or dropping a package cannot pass on a count.
  assert.deepEqual(bundled.packages.map((pkg) => pkg.id).toSorted(), [
    "ts-rspc-client",
    "ts-rspc-normi",
    "ts-rspc-playground",
    "ts-rspc-query-core",
    "ts-rspc-react",
    "ts-rspc-react-query",
    "ts-rspc-solid",
    "ts-rspc-solid-query",
    "ts-rspc-svelte-query",
    "ts-rspc-tanstack-query",
    "ts-rspc-tauri",
  ]);
  for (const pkg of bundled.packages) {
    const folder = `content/docs/rspc/typescript-api/${pkg.id}`;
    assert.match(
      await read(`${folder}/index.mdx`),
      new RegExp(`version="${pkg.homeVersion.replace(/\./g, "\\.")}"`),
    );
    // Every release the switcher offers as a page on this site must exist.
    for (const release of pkg.versions) {
      if (!release.onSite) continue;
      const file =
        release.version === pkg.homeVersion
          ? "index.mdx"
          : `${release.version}.mdx`;
      assert.match(await read(`${folder}/${file}`), /^---\n/);
    }
  }
});
