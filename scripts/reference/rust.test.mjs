import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
  compareVersions,
  generate,
  parseAllHtml,
  parseItemHtml,
  parseModulesHtml,
  parseRustdoc,
  readHtmlArchive,
  rustType,
} from "./rust.mjs";

test("semver descending includes prereleases and numeric prerelease ordering", () => {
  assert.deepEqual(
    [
      "2.0.0-rc.2",
      "1.9.0",
      "2.0.0-rc.10",
      "2.0.0",
      "2.0.0-alpha",
      "2.0.0-rc",
    ].toSorted(compareVersions),
    ["2.0.0", "2.0.0-rc.10", "2.0.0-rc.2", "2.0.0-rc", "2.0.0-alpha", "1.9.0"],
  );
  assert.equal(
    compareVersions("1.0.0-alpha-test.10", "1.0.0-alpha-test.2"),
    -8,
  );
  assert.equal(compareVersions("1.0.0+build.2", "1.0.0+build.1"), 0);
});

const base = "https://docs.rs/example/1.0.0/example/";
test("HTML all-items ignores navigation, dependencies and unsafe outbound links", () => {
  const html =
    '<a href="struct.Ignore.html">Ignore</a><section id="main-content"><ul class="all-items"><li><a href="nested/struct.Example.html">nested::Example</a></li><a href="https://evil.test/struct.Bad.html">Bad</a><a href="../other/struct.Dependency.html">Dependency</a></ul></section>';
  assert.deepEqual(parseAllHtml(html, base), [
    {
      name: "nested::Example",
      kind: "struct",
      description: "",
      url: base + "nested/struct.Example.html",
    },
  ]);
});

test("HTML declarations, inherent methods and own trait members exclude blanket impls", () => {
  const symbol = {
    name: "Example",
    kind: "struct",
    description: "",
    url: base + "struct.Example.html",
  };
  const html =
    '<section id="main-content"><pre class="rust item-decl">pub struct Example;</pre><div class="docblock"><p>Example &amp; documentation.</p></div><section id="method.new"><h4>pub fn new() -&gt; Self</h4></section><div class="docblock"><p>Construct it.</p></div><h2 id="trait-implementations">Traits</h2><section id="method.from"><h4>fn from()</h4></section></section>';
  const symbols = parseItemHtml(html, symbol);
  assert.equal(symbols.length, 2);
  assert.equal(symbols[0].description, "Example & documentation.");
  assert.equal(symbols[1].url, symbol.url + "#method.new");
  assert.equal(symbols[1].signature, "pub fn new() -> Self");
});

const derefHtml =
  '<section id="main-content"><section id="method.new"><h4>pub fn new() -&gt; Self</h4></section><h2 class="section-header" id="deref-methods-HashMap">Deref methods</h2><section id="method.capacity"><h4>pub fn capacity()</h4></section><section id="method.extract_if"><h4>pub fn extract_if()</h4></section><section id="method.try_insert"><h4>pub fn try_insert()</h4></section><h2 id="trait-implementations">Traits</h2></section>';

test("HTML excludes inherited Deref methods before the trait implementation boundary", () => {
  assert.deepEqual(
    parseItemHtml(derefHtml, {
      name: "Procedures",
      kind: "struct",
      url: base + "struct.Procedures.html",
      description: "",
    }).map((s) => s.name),
    ["Procedures", "Procedures::new"],
  );
});

test("module discovery reads only public Modules listings and stays inside the crate", () => {
  const html =
    '<section id="main-content"><div class="docblock"><a class="mod" href="private/index.html">private</a></div><h2 id="modules">Modules</h2><dl><dt><a class="mod" href="ts/index.html">ts</a></dt><dt><a class="mod" href="https://docs.rs/dep/1.0.0/dep/index.html">dep</a></dt></dl><h2 id="structs">Structs</h2><a class="mod" href="not_a_module/index.html">not_a_module</a></section>';
  assert.deepEqual(parseModulesHtml(html, base + "index.html", base), [
    { name: "ts", kind: "mod", description: "", url: base + "ts/index.html" },
  ]);
  assert.equal(
    parseModulesHtml(html, base + "nested/index.html", base, "nested")[0].name,
    "nested::ts",
  );
});

test("HTML enum named fields retain names, docs, signatures and exact fragments", () => {
  const html =
    '<section id="main-content"><section id="variant.Inline"><h3>Inline</h3></section><div class="sub-variant"><span id="variant.Inline.field.dt" class="section-header"><a href="#variant.Inline.field.dt">§</a><code>dt: Box&lt;DataType&gt;</code></span><div class="docblock"><p>Inline datatype.</p></div></div><section id="variant.Reference"><h3>Reference</h3></section><section id="variant.Reference.field.generics"><code>generics: Vec&lt;DataType&gt;</code></section><div class="docblock"><p>Generic arguments.</p></div><h2 id="trait-implementations">Traits</h2></section>';
  const symbols = parseItemHtml(html, {
    name: "NamedReferenceType",
    kind: "enum",
    description: "",
    url: base + "enum.NamedReferenceType.html",
  });
  const field = symbols.find(
    (s) => s.name === "NamedReferenceType::Inline::dt",
  );
  assert.equal(field.kind, "structfield");
  assert.equal(field.description, "Inline datatype.");
  assert.equal(field.signature, "dt: Box<DataType>");
  assert.equal(
    field.url,
    base + "enum.NamedReferenceType.html#variant.Inline.field.dt",
  );
  assert.ok(
    symbols.some(
      (s) =>
        s.name === "NamedReferenceType::Reference::generics" &&
        s.kind === "structfield",
    ),
  );
  assert.equal(symbols.filter((s) => s.kind === "variant").length, 2);
});

const item = (name, inner, visibility = "public", extra = {}) => ({
  name,
  inner,
  visibility,
  crate_id: 0,
  attrs: [],
  docs: `${name} docs.`,
  ...extra,
});
const fixture = () => ({
  root: "root",
  index: {
    root: item("example", {
      module: { items: ["private", "export", "dep", "hidden", "trait"] },
    }),
    private: item("private", { module: { items: ["thing"] } }, "default"),
    thing: item("Thing", {
      struct: {
        kind: { plain: { fields: ["field", "privateField"] } },
        impls: ["impl", "traitImpl"],
      },
    }),
    export: item(null, {
      use: { id: "thing", name: "Renamed", is_glob: false },
    }),
    dep: item("Dependency", { struct: { impls: [] } }, "public", {
      crate_id: 1,
    }),
    hidden: item("Hidden", { struct: { impls: [] } }, "public", {
      attrs: [{ other: "#[doc(hidden)]" }],
    }),
    impl: item(
      null,
      { impl: { items: ["method", "privateMethod"], trait: null } },
      "default",
    ),
    traitImpl: item(
      null,
      { impl: { items: ["dependencyMethod"], trait: { path: "Clone" } } },
      "default",
    ),
    method: item("new", {
      function: {
        sig: { inputs: [], output: { generic: "Self" } },
        has_body: true,
      },
    }),
    privateMethod: item(
      "secret",
      { function: { sig: { inputs: [] } } },
      "default",
    ),
    dependencyMethod: item("clone", { function: { sig: { inputs: [] } } }),
    field: item("value", { struct_field: { primitive: "str" } }),
    privateField: item(
      "secret",
      { struct_field: { primitive: "str" } },
      "default",
    ),
    trait: item("Trait", { trait: { items: ["required", "associated"] } }),
    required: item(
      "required",
      {
        function: {
          sig: {
            inputs: [
              [
                "self",
                {
                  borrowed_ref: {
                    type: { generic: "Self" },
                    is_mutable: false,
                  },
                },
              ],
            ],
            output: null,
          },
          has_body: false,
        },
      },
      "default",
    ),
    associated: item("Output", { assoc_type: {} }, "default"),
  },
});

test("JSON enum fields inherit public variant visibility but exclude doc-hidden fields", () => {
  const doc = fixture();
  doc.index.root.inner.module.items = ["enum"];
  doc.index.enum = item("NamedReferenceType", {
    enum: { variants: ["variant", "tupleVariant"], impls: [] },
  });
  doc.index.variant = item(
    "Inline",
    { variant: { kind: { struct: { fields: ["dt", "hiddenField"] } } } },
    "default",
  );
  doc.index.dt = item("dt", { struct_field: { primitive: "u8" } }, "default");
  doc.index.tupleVariant = item(
    "Recursive",
    { variant: { kind: { tuple: ["tuplePayload"] } } },
    "default",
  );
  doc.index.tuplePayload = item(
    "0",
    { struct_field: { primitive: "u8" } },
    "default",
  );
  doc.index.hiddenField = item(
    "secret",
    { struct_field: { primitive: "u8" } },
    "default",
    { attrs: ["#[doc(hidden)]"] },
  );
  const symbols = parseRustdoc(doc, base);
  assert.deepEqual(
    symbols.map((s) => s.name),
    [
      "NamedReferenceType",
      "NamedReferenceType::Inline",
      "NamedReferenceType::Inline::dt",
      "NamedReferenceType::Recursive",
    ],
  );
  assert.equal(symbols[2].kind, "structfield");
  assert.equal(
    symbols[2].url,
    base + "enum.NamedReferenceType.html#variant.Inline.field.dt",
  );
});

test("rustdoc traverses public API and renamed reexports, excludes private/dependency/hidden/trait impls", () => {
  const symbols = parseRustdoc(fixture(), base);
  assert.deepEqual(
    symbols.map((s) => s.name),
    [
      "Renamed",
      "Renamed::new",
      "Renamed::value",
      "Trait",
      "Trait::Output",
      "Trait::required",
    ],
  );
  assert.equal(
    symbols.find((s) => s.name === "Renamed").url,
    base + "struct.Renamed.html",
  );
  assert.equal(
    symbols.find((s) => s.name === "Renamed::new").signature,
    "fn new() -> Self",
  );
  assert.equal(
    symbols.find((s) => s.name === "Trait::required").url,
    base + "trait.Trait.html#tymethod.required",
  );
});

test("rustdoc glob reexports and cycles are bounded", () => {
  const doc = fixture();
  doc.index.export.inner.use.is_glob = true;
  doc.index.export.inner.use.id = "private";
  doc.index.private.inner.module.items.push("export");
  assert.ok(parseRustdoc(doc, base).some((s) => s.name === "Thing"));
});

test("rustdoc authoritative HTML URLs override implementation module paths", () => {
  const symbols = parseRustdoc(fixture(), base, [
    {
      name: "Renamed",
      kind: "struct",
      url: base + "actual/struct.Renamed.html",
    },
  ]);
  assert.equal(
    symbols.find((s) => s.name === "Renamed::new").url,
    base + "actual/struct.Renamed.html#method.new",
  );
});

test("non-inlined renamed reexports link to their canonical public page", () => {
  const doc = fixture();
  doc.paths = { thing: { path: ["example", "visible", "Thing"] } };
  const symbols = parseRustdoc(doc, base, [
    {
      name: "visible::Thing",
      kind: "struct",
      url: base + "visible/struct.Thing.html",
    },
    { name: "Trait", kind: "trait", url: base + "trait.Trait.html" },
  ]);
  assert.equal(
    symbols.find((s) => s.name === "Renamed").url,
    base + "visible/struct.Thing.html",
  );
  assert.equal(
    symbols.find((s) => s.name === "Renamed::new").url,
    base + "visible/struct.Thing.html#method.new",
  );
});

test("Rust types render references, tuples and generics", () => {
  assert.equal(rustType("never"), "!");
  assert.equal(rustType("infer"), "_");
  assert.equal(
    rustType({
      borrowed_ref: {
        lifetime: "'a",
        is_mutable: true,
        type: { slice: { primitive: "u8" } },
      },
    }),
    "&'a mut [u8]",
  );
  assert.equal(rustType({ tuple: [{ primitive: "u8" }] }), "(u8,)");
  assert.equal(
    rustType({
      resolved_path: {
        path: "Option",
        args: { angle_bracketed: { args: [{ type: { generic: "T" } }] } },
      },
    }),
    "Option<T>",
  );
});

test("BZIP2 docs archive reads only the default crate without extracting paths", (t) => {
  if (spawnSync("python3", ["--version"]).status !== 0)
    return t.skip("Python 3 archive optimization is optional");
  const zip = Buffer.from(
    "UEsDBC4AAAAMACiKVl0rCsTmQwAAABwAAAAbAAAAZXhhbXBsZS9zdHJ1Y3QuRXhhbXBsZS5odG1sQlpoOTFBWSZTWcTIcIQAAAIbgEABgAVAAD4nxgAgADFMmJkGRhQGgGJ+qYW1UeEvDGgR7oGXVgPi7kinChIYmQ4QgFBLAwQuAAAADAAoilZd4taIDSoAAAAGAAAAHAAAAG90aGVyL3N0cnVjdC5EZXBlbmRlbmN5Lmh0bWxCWmg5MUFZJlNZb0/czgAAAQGAAqGQACAAIYAMA0cu4u5IpwoSDen7mcBQSwMELgAAAAwAKIpWXVW73O4yAAAADQAAAA8AAAAuLi9vdXRzaWRlLmh0bWxCWmg5MUFZJlNZoCPAUAAAAxGAQAAqARVAIAAhoGnqCDJiGqNwJOteLuSKcKEhQEeAoFBLAQIuAy4AAAAMACiKVl0rCsTmQwAAABwAAAAbAAAAAAAAAAAAAACAAQAAAABleGFtcGxlL3N0cnVjdC5FeGFtcGxlLmh0bWxQSwECLgMuAAAADAAoilZd4taIDSoAAAAGAAAAHAAAAAAAAAAAAAAAgAF8AAAAb3RoZXIvc3RydWN0LkRlcGVuZGVuY3kuaHRtbFBLAQIuAy4AAAAMACiKVl1Vu9zuMgAAAA0AAAAPAAAAAAAAAAAAAACAAeAAAAAuLi9vdXRzaWRlLmh0bWxQSwUGAAAAAAMAAwDQAAAAPwEAAAAA",
    "base64",
  );
  assert.deepEqual(readHtmlArchive(zip, "example"), {
    "struct.Example.html": "<p>Public documentation.</p>",
  });
  // A self-extracting ZIP prefix makes stdin larger than the pipe buffer and
  // guards against waiting indefinitely for EOF in a synchronous subprocess.
  assert.deepEqual(
    readHtmlArchive(
      Buffer.concat([Buffer.alloc(2 * 1024 * 1024), zip]),
      "example",
    ),
    { "struct.Example.html": "<p>Public documentation.</p>" },
  );
  assert.equal(
    readHtmlArchive(Buffer.from("invalid zip"), "example"),
    undefined,
  );
});

test("offline generator covers all releases, yanks, missing docs and reproducible gzip input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rust-reference-test-"));
  try {
    const cacheDir = join(directory, "cache");
    const outputDir = join(directory, "rust");
    await mkdir(cacheDir);
    const save = async (url, status, body) =>
      writeFile(
        join(
          cacheDir,
          createHash("sha256").update(url).digest("hex") + ".json",
        ),
        JSON.stringify({
          status,
          url,
          body: Buffer.from(body).toString("base64"),
        }),
      );
    await save(
      "https://crates.io/api/v1/crates/example",
      200,
      JSON.stringify({
        crate: { default_version: "1.0.0" },
        versions: [
          { num: "1.0.0" },
          { num: "2.0.0-rc.10", yanked: true },
          { num: "0.1.0" },
        ],
      }),
    );
    for (const version of ["1.0.0", "2.0.0-rc.10", "0.1.0"]) {
      await save(
        `https://docs.rs/crate/example/${version}/json.gz`,
        version === "0.1.0" ? 404 : 200,
        version === "0.1.0" ? "" : gzipSync(JSON.stringify(fixture())),
      );
      await save(
        `https://docs.rs/example/${version}/example/all.html`,
        version === "1.0.0" ? 200 : 404,
        version === "1.0.0"
          ? '<section id="main-content"><a href="derive.Type.html">Type</a><a href="struct.Procedures.html">Procedures</a></section>'
          : "",
      );
    }
    await save(
      "https://docs.rs/example/1.0.0/example/derive.Type.html",
      200,
      '<section id="main-content"><div class="docblock"><p>Derive the Type trait.</p></div></section>',
    );
    await save(
      "https://docs.rs/example/1.0.0/example/struct.Procedures.html",
      200,
      derefHtml,
    );
    const options = {
      outputDir,
      cacheDir,
      offline: true,
      selected: [["example", "specta"]],
    };
    const result = await generate(options);
    const [pkg] = result.packages;
    assert.deepEqual(
      pkg.versions.map((v) => v.version),
      ["2.0.0-rc.10", "1.0.0", "0.1.0"],
    );
    assert.equal(pkg.defaultVersion, "1.0.0");
    assert.equal(pkg.versions[0].yanked, true);
    assert.match(pkg.versions[2].unavailable, /unavailable/);
    assert.equal(
      pkg.versions[1].data,
      "reference/rust/rust-example/1.0.0.json",
    );
    const first = await readFile(
      join(outputDir, "rust-example/1.0.0.json"),
      "utf8",
    );
    assert.ok(JSON.parse(first).symbols.length);
    assert.ok(
      JSON.parse(first).symbols.some((s) => s.name === "Procedures::new"),
    );
    assert.ok(
      !JSON.parse(first).symbols.some((s) =>
        /::(?:capacity|extract_if|try_insert)$/.test(s.name),
      ),
    );
    assert.ok(
      JSON.parse(first).symbols.some(
        (s) =>
          s.name === "Type" &&
          s.kind === "derive" &&
          s.description === "Derive the Type trait.",
      ),
    );
    await generate(options);
    assert.equal(
      await readFile(join(outputDir, "rust-example/1.0.0.json"), "utf8"),
      first,
    );
    assert.equal(
      await readFile(`${outputDir}.json`, "utf8"),
      JSON.stringify(result, null, 2) + "\n",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("offline HTML fallback traverses nested public module listings without archive-directory discovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rust-module-test-"));
  try {
    const cacheDir = join(directory, "cache");
    await mkdir(cacheDir);
    const save = async (url, status, html) =>
      writeFile(
        join(
          cacheDir,
          createHash("sha256").update(url).digest("hex") + ".json",
        ),
        JSON.stringify({
          status,
          url,
          body: Buffer.from(html).toString("base64"),
        }),
      );
    await save(
      "https://crates.io/api/v1/crates/example",
      200,
      JSON.stringify({
        crate: { default_version: "1.0.0" },
        versions: [{ num: "1.0.0" }],
      }),
    );
    await save("https://docs.rs/crate/example/1.0.0/json.gz", 404, "");
    await save("https://docs.rs/crate/example/1.0.0/download", 404, "");
    await save(
      base + "all.html",
      200,
      '<section id="main-content">No non-module items</section>',
    );
    await save(
      base + "index.html",
      200,
      '<section id="main-content"><a class="mod" href="private/index.html">private</a><h2 id="modules">Modules</h2><a class="mod" href="ts/index.html">ts</a><a class="mod" href="https://docs.rs/dependency/1.0.0/dependency/index.html">dependency</a></section>',
    );
    await save(
      base + "ts/index.html",
      200,
      '<section id="main-content"><div class="docblock"><p>TypeScript exporter.</p></div><h2 id="modules">Modules</h2><a href="nested/index.html" class="mod">nested</a></section>',
    );
    await save(
      base + "ts/nested/index.html",
      200,
      '<section id="main-content"><div class="docblock"><p>Nested helpers.</p></div></section>',
    );
    await generate({
      outputDir: join(directory, "rust"),
      cacheDir,
      offline: true,
      selected: [["example", "specta"]],
    });
    const data = JSON.parse(
      await readFile(join(directory, "rust/rust-example/1.0.0.json"), "utf8"),
    );
    assert.equal(data.source, "rustdoc-html");
    assert.deepEqual(
      data.symbols.map((s) => s.name),
      ["ts", "ts::nested"],
    );
    assert.equal(data.symbols[0].url, base + "ts/index.html");
    assert.equal(data.symbols[0].description, "TypeScript exporter.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const artifact = async (crate, version) =>
  JSON.parse(
    await readFile(
      new URL(
        `../../reference/rust/rust-${crate}/${version}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ).symbols;

test("real release regressions retain modules and variant fields, not inherited HashMap methods", async () => {
  const procedures = await artifact("rspc", "0.4.1");
  assert.ok(
    !procedures.some((s) =>
      /^Procedures::(?:capacity|extract_if|try_insert)$/.test(s.name),
    ),
  );
  const legacy = await artifact("specta", "1.0.5");
  assert.ok(
    legacy.some(
      (s) =>
        s.name === "ts" &&
        s.kind === "mod" &&
        s.url === "https://docs.rs/specta/1.0.5/specta/ts/index.html",
    ),
  );
  const current = await artifact("specta", "2.0.0-rc.27");
  assert.ok(!current.some((s) => s.url.includes("#variant.Recursive.field.0")));
  for (const [variant, field] of [
    ["Inline", "dt"],
    ["Reference", "generics"],
  ]) {
    assert.ok(
      current.some(
        (s) =>
          s.name === `datatype::NamedReferenceType::${variant}::${field}` &&
          s.kind === "structfield" &&
          s.url ===
            `https://docs.rs/specta/2.0.0-rc.27/specta/datatype/enum.NamedReferenceType.html#variant.${variant}.field.${field}`,
      ),
    );
  }
});
