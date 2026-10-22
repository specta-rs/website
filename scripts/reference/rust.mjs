import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const crates = [
  ["specta", "specta"],
  ["specta-typescript", "specta"],
  ["specta-serde", "specta"],
  ["specta-util", "specta"],
  ["specta-macros", "specta"],
  ["specta-jsdoc", "specta"],
  ["specta-zod", "specta"],
  ["tauri-specta", "tauri-specta"],
  ["rspc", "rspc"],
  ["rspc-axum", "rspc"],
  ["rspc-tauri", "rspc"],
  ["rspc-procedure", "rspc"],
];
const kinds = {
  module: "mod",
  function: "fn",
  type_alias: "type",
  constant: "constant",
  static: "static",
  proc_derive: "derive",
  proc_attribute: "attr",
  proc_macro: "macro",
  macro: "macro",
  struct: "struct",
  enum: "enum",
  union: "union",
  trait: "trait",
  trait_alias: "trait",
  primitive: "primitive",
};

function parseVersion(v) {
  const withoutBuild = v.split("+")[0];
  const separator = withoutBuild.indexOf("-");
  return {
    core: (separator === -1 ? withoutBuild : withoutBuild.slice(0, separator))
      .split(".")
      .map(Number),
    pre:
      separator === -1
        ? undefined
        : withoutBuild.slice(separator + 1).split("."),
  };
}

export function compareVersions(a, b) {
  const x = parseVersion(a),
    y = parseVersion(b);
  for (let i = 0; i < 3; i++)
    if (x.core[i] !== y.core[i]) return y.core[i] - x.core[i];
  if (!x.pre || !y.pre) return x.pre ? 1 : y.pre ? -1 : 0;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const u = x.pre[i],
      v = y.pre[i];
    if (u === undefined || v === undefined) return u === undefined ? 1 : -1;
    if (u === v) continue;
    const un = /^\d+$/.test(u),
      vn = /^\d+$/.test(v);
    if (un && vn) return Number(v) - Number(u);
    if (un !== vn) return un ? 1 : -1;
    return u < v ? 1 : -1;
  }
  return 0;
}

export function text(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, entity) => {
      if (entity.startsWith("#"))
        return String.fromCodePoint(
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1)),
        );
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[
          entity
        ] ?? all
      );
    })
    .replace(/\s+/g, " ")
    .trim();
}

function description(docs = "") {
  return text(
    (docs ?? "")
      .split(/\n\s*\n/)[0]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]/g, "$1")
      .replace(/[`*]/g, ""),
  ).slice(0, 1200);
}

export function parseAllHtml(html, base) {
  const main =
    html.match(
      /<section[^>]*id="main-content"[^>]*>([\s\S]*?)<\/section>/,
    )?.[1] ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ??
    "";
  const symbols = [];
  for (const match of main.matchAll(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    const [, href, label] = match;
    if (
      !/^(?:[\w-]+\/)*(?:struct|enum|trait|union|type|fn|constant|static|macro|derive|attr|primitive)\.[^/]+\.html$/.test(
        href,
      )
    )
      continue;
    symbols.push({
      name: text(label),
      kind: href.split("/").at(-1).split(".")[0],
      description: "",
      url: new URL(href, base).href,
    });
  }
  return symbols;
}

export function parseModulesHtml(html, pageUrl, rootUrl, parentName = "") {
  const main = html.slice(html.indexOf('id="main-content"'));
  const listing =
    main.match(
      /<h2\b[^>]*id="modules"[^>]*>[\s\S]*?(?=<h2\b|<\/section>|<\/main>|$)/,
    )?.[0] ?? "";
  const modules = [];
  for (const [, attrs, label] of listing.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/g,
  )) {
    const href = attrs.match(/\bhref="([^"]+)"/)?.[1];
    const classes = attrs.match(/\bclass="([^"]+)"/)?.[1]?.split(/\s+/) ?? [];
    if (!href || !classes.includes("mod")) continue;
    const url = new URL(href, pageUrl).href;
    if (!url.startsWith(rootUrl) || !url.endsWith("/index.html")) continue;
    modules.push({
      name: [parentName, text(label)].filter(Boolean).join("::"),
      kind: "mod",
      description: "",
      url,
    });
  }
  return modules;
}

async function discoverModules(base, pages, download) {
  const queue = [{ url: `${base}index.html`, name: "" }];
  const visited = new Set();
  const modules = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (visited.has(current.url)) continue;
    visited.add(current.url);
    let html = pages?.[current.url.slice(base.length)];
    if (html === undefined) {
      const page = await download(current.url);
      if (page.status !== 200)
        throw new Error(`rustdoc module ${current.url}: HTTP ${page.status}`);
      html = page.body.toString();
    }
    if (current.name)
      modules.push(
        parseItemHtml(html, { ...current, kind: "mod", description: "" })[0],
      );
    // Only module links in a publicly reachable module's Modules listing are
    // eligible. Private archive directories and prose/dependency links aren't.
    queue.push(...parseModulesHtml(html, current.url, base, current.name));
  }
  return modules;
}

// These are rustdoc-generated item sections, not sidebar links or blanket impls.
export function parseItemHtml(html, symbol) {
  const result = { ...symbol };
  const declaration = html.match(
    /<pre\b[^>]*class="[^"]*item-decl[^"]*"[^>]*>([\s\S]*?)<\/pre>/,
  );
  if (declaration) result.signature = text(declaration[1]);
  const main = html.slice(html.indexOf('id="main-content"'));
  const doc = main
    .split(/<h2\b/)[0]
    .match(/<div class="docblock">\s*<p>([\s\S]*?)<\/p>/);
  if (doc) result.description = text(doc[1]);
  const members = [];
  // Only inherent implementations and a trait's own members: exclude trait,
  // auto-trait and blanket implementations, including inherited dependency APIs.
  const own = main.split(
    /<h2[^>]*id="(?:deref-methods(?:-[^"]*)?|trait-implementations|synthetic-implementations|blanket-implementations)"/,
  )[0];
  for (const match of own.matchAll(
    /<section\b[^>]*id="((?:method|tymethod|associatedconstant|associatedtype|variant|structfield)\.[^".]+)"[^>]*>([\s\S]*?)<\/section>/g,
  )) {
    const [, anchor, body] = match;
    const memberName = anchor
      .slice(anchor.indexOf(".") + 1)
      .replace(/-\d+$/, "");
    const heading = body.match(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/);
    const following = own.slice(
      match.index + match[0].length,
      match.index + match[0].length + 5000,
    );
    const docs = following.match(
      /^\s*(?:<\/summary>)?\s*(?:<div class="docblock">)\s*<p>([\s\S]*?)<\/p>/,
    );
    members.push({
      name: `${symbol.name}::${memberName}`,
      kind: anchor.split(".")[0],
      description: docs ? text(docs[1]) : "",
      ...(heading
        ? { signature: text(heading[1]).replace(/§/g, "").trim() }
        : {}),
      url: `${symbol.url}#${anchor}`,
    });
  }
  for (const match of own.matchAll(
    /<(span|section)\b[^>]*id="(variant\.([^".]+)\.field\.([^"]+))"[^>]*>([\s\S]*?)<\/\1>/g,
  )) {
    const [, , anchor, variant, field, body] = match;
    const following = own.slice(match.index + match[0].length);
    const docs = following.match(
      /^\s*<div class="docblock">\s*<p>([\s\S]*?)<\/p>/,
    );
    const fieldDeclaration = body.match(/<code>([\s\S]*?)<\/code>/)?.[1];
    members.push({
      name: `${symbol.name}::${variant}::${field}`,
      kind: "structfield",
      description: docs ? text(docs[1]) : "",
      ...(fieldDeclaration ? { signature: text(fieldDeclaration) } : {}),
      url: `${symbol.url}#${anchor}`,
    });
  }
  return [result, ...members];
}

// docs.rs ZIPs use BZIP2, which Node's zlib cannot decode. Python is an
// optional download optimization; without it we fetch individual HTML pages.
// Read entries in memory instead of extracting untrusted archive paths.
export function readHtmlArchive(bytes, crateRoot) {
  try {
    return JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          'import io,json,sys,zipfile\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read(int(sys.argv[2]))))\nprefix=sys.argv[1]+"/"\nfiles=[i for i in z.infolist() if i.filename.startswith(prefix) and i.filename.endswith(".html")]\nif sum(i.file_size for i in files)>128*1024*1024: raise ValueError("Documentation archive exceeds limit")\nprint(json.dumps({i.filename[len(prefix):]:z.read(i).decode("utf-8") for i in files}))',
          crateRoot,
          String(bytes.length),
        ],
        {
          input: bytes,
          encoding: "utf8",
          maxBuffer: 128 * 1024 * 1024,
          timeout: 30000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      ),
    );
  } catch {
    return undefined;
  }
}

export function rustType(type) {
  if (!type) return "()";
  if (typeof type === "string") return type === "never" ? "!" : "_";
  if (type.primitive || type.generic) return type.primitive ?? type.generic;
  if (type.resolved_path) {
    const p = type.resolved_path,
      args = p.args?.angle_bracketed;
    return (
      (p.path ?? p.name) +
      (args?.args?.length
        ? `<${args.args.map((a) => (a.type ? rustType(a.type) : (a.lifetime ?? a.const?.expr ?? "_"))).join(", ")}>`
        : "")
    );
  }
  if (type.borrowed_ref) {
    const r = type.borrowed_ref;
    return `&${r.lifetime ? r.lifetime + " " : ""}${r.is_mutable ? "mut " : ""}${rustType(r.type)}`;
  }
  if (type.raw_pointer)
    return `*${type.raw_pointer.is_mutable ? "mut" : "const"} ${rustType(type.raw_pointer.type)}`;
  if (type.tuple)
    return `(${type.tuple.map(rustType).join(", ")}${type.tuple.length === 1 ? "," : ""})`;
  if (type.slice) return `[${rustType(type.slice)}]`;
  if (type.array) return `[${rustType(type.array.type)}; ${type.array.len}]`;
  if (type.impl_trait)
    return `impl ${type.impl_trait.map((b) => (b.trait_bound ? rustType({ resolved_path: b.trait_bound.trait }) : (b.outlives ?? "_"))).join(" + ")}`;
  if (type.qualified_path) {
    const p = type.qualified_path;
    return `<${rustType(p.self_type)}${p.trait ? " as " + rustType({ resolved_path: p.trait }) : ""}>::${p.name}`;
  }
  if (type.dyn_trait)
    return `dyn ${type.dyn_trait.traits.map((t) => rustType({ resolved_path: t.trait })).join(" + ")}`;
  if (type.infer) return "_";
  if (type.function_pointer)
    return `fn(${type.function_pointer.sig.inputs.map(([, t]) => rustType(t)).join(", ")}) -> ${rustType(type.function_pointer.sig.output)}`;
  if ("never" in type) return "!";
  return "_";
}

function signature(item) {
  const f = item.inner.function;
  if (!f) return undefined;
  const sig = f.sig ?? f.decl;
  if (!sig) return undefined;
  const generics = (f.generics?.params ?? [])
    .filter((p) => !p.kind?.type?.is_synthetic)
    .map((p) => p.name);
  return `${f.header?.is_const ? "const " : ""}${f.header?.is_async ? "async " : ""}${f.header?.is_unsafe ? "unsafe " : ""}fn ${item.name}${generics.length ? "<" + generics.join(", ") + ">" : ""}(${sig.inputs.map(([n, t]) => `${n}: ${rustType(t)}`).join(", ")}${sig.is_c_variadic ? ", ..." : ""})${sig.output ? " -> " + rustType(sig.output) : ""}`;
}

function hidden(item) {
  return (item.attrs ?? []).some((a) =>
    /#\[doc\(hidden\)\]/.test(typeof a === "string" ? a : (a.other ?? "")),
  );
}

export function parseRustdoc(doc, base, htmlSymbols = []) {
  if (!doc.index?.[doc.root]?.inner?.module)
    throw new Error("Unsupported rustdoc JSON: missing crate root module");
  const output = [],
    seen = new Set();
  const rootCrate = doc.index[doc.root].crate_id;
  function visit(itemId, path, renamed, ancestors = new Set()) {
    const item = doc.index[itemId];
    if (
      !item ||
      item.crate_id !== rootCrate ||
      hidden(item) ||
      ancestors.has(itemId)
    )
      return;
    const [rawKind, inner] = Object.entries(item.inner)[0];
    const use = item.inner.use ?? item.inner.import;
    if (use) {
      if (item.visibility !== "public" || use.id == null) return;
      if (use.is_glob || use.glob) {
        const module = doc.index[use.id]?.inner.module;
        for (const child of module?.items ?? [])
          if (doc.index[child]?.visibility === "public")
            visit(child, path, undefined, new Set([...ancestors, itemId]));
      } else visit(use.id, path, use.name, new Set([...ancestors, itemId]));
      return;
    }
    if (item.visibility !== "public" && !renamed) return;
    const name = renamed ?? item.name;
    if (!name) return;
    const fullPath = [...path, name];
    const kind =
      rawKind === "proc_macro"
        ? ({ bang: "macro", attr: "attr", derive: "derive" }[inner.kind] ??
          "macro")
        : kinds[rawKind];
    if (!kind) return;
    const fullName = fullPath.join("::");
    const canonicalName = doc.paths?.[itemId]?.path?.slice(1).join("::");
    const originalMatches = renamed
      ? htmlSymbols.filter(
          (s) => s.kind === kind && s.name.split("::").at(-1) === item.name,
        )
      : [];
    const authoritative =
      htmlSymbols.find((s) => s.name === fullName && s.kind === kind) ??
      htmlSymbols.find((s) => s.name === canonicalName && s.kind === kind) ??
      (originalMatches.length === 1 ? originalMatches[0] : undefined);
    // Non-inlined aliases link to the original public page, not an invented
    // `struct.Alias.html`. The item list is authoritative when it is available.
    if (htmlSymbols.length && !authoritative && kind !== "mod") return;
    const url =
      authoritative?.url ??
      new URL(
        kind === "mod"
          ? `${fullPath.join("/")}/index.html`
          : `${path.length ? path.join("/") + "/" : ""}${kind}.${name}.html`,
        base,
      ).href;
    const key = `${kind}:${fullName}`;
    if (seen.has(key)) return;
    seen.add(key);
    const sig = signature({ ...item, name });
    output.push({
      name: fullName,
      kind,
      description: description(item.docs),
      ...(sig ? { signature: sig } : {}),
      url,
    });
    if (rawKind === "module")
      for (const child of inner.items)
        visit(child, fullPath, undefined, new Set([...ancestors, itemId]));
    const members = [];
    if (rawKind === "trait")
      members.push(...inner.items.map((id) => [id, true]));
    for (const implId of inner.impls ?? inner.implementations ?? []) {
      const implItem = doc.index[implId];
      const impl = implItem?.inner.impl;
      if (
        !impl ||
        impl.trait ||
        impl.is_synthetic ||
        impl.blanket_impl ||
        hidden(implItem) ||
        implItem.crate_id !== rootCrate
      )
        continue;
      members.push(...impl.items.map((id) => [id, false]));
    }
    if (rawKind === "enum")
      members.push(...inner.variants.map((id) => [id, true]));
    if (rawKind === "struct")
      members.push(
        ...(inner.kind?.plain?.fields ?? []).map((id) => [id, false]),
      );
    if (rawKind === "union")
      members.push(...(inner.fields ?? []).map((id) => [id, false]));
    for (const [memberId, implicitPublic] of members) {
      const m = doc.index[memberId];
      if (
        !m?.name ||
        hidden(m) ||
        (!implicitPublic && m.visibility !== "public")
      )
        continue;
      const mk = Object.keys(m.inner)[0];
      const anchor = {
        function:
          mk === "function" && m.inner.function.has_body === false
            ? "tymethod"
            : "method",
        assoc_const: "associatedconstant",
        assoc_type: "associatedtype",
        variant: "variant",
        struct_field: "structfield",
      }[mk];
      if (!anchor) continue;
      const memberKey = `${key}::${m.name}:${anchor}`;
      if (seen.has(memberKey)) continue;
      seen.add(memberKey);
      const memberSig = signature(m);
      output.push({
        name: `${fullName}::${m.name}`,
        kind: anchor,
        description: description(m.docs),
        ...(memberSig ? { signature: memberSig } : {}),
        url: `${url}#${anchor}.${m.name}`,
      });
      if (mk === "variant") {
        // Rustdoc gives named variant fields their own anchors. Tuple payloads
        // are part of the variant declaration and have no field anchors.
        const fields = m.inner.variant.kind?.struct?.fields ?? [];
        for (const fieldId of fields) {
          const field = doc.index[fieldId];
          if (!field?.name || hidden(field)) continue;
          output.push({
            name: `${fullName}::${m.name}::${field.name}`,
            kind: "structfield",
            description: description(field.docs),
            url: `${url}#variant.${m.name}.field.${field.name}`,
          });
        }
      }
    }
  }
  for (const id of doc.index[doc.root].inner.module.items) visit(id, []);
  return output.toSorted(
    (a, b) =>
      a.name.localeCompare(b.name, "en") || a.kind.localeCompare(b.kind, "en"),
  );
}

export function createDownloader({
  cacheDir,
  offline = false,
  refresh = false,
  interval = 150,
}) {
  let nextStart = 0;
  return async function download(url) {
    const cache = join(
      cacheDir,
      createHash("sha256").update(url).digest("hex") + ".json",
    );
    if (!refresh || offline) {
      try {
        const saved = JSON.parse(await readFile(cache, "utf8"));
        return { ...saved, body: Buffer.from(saved.body, "base64") };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (offline) throw new Error(`Not cached: ${url}`);
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = Math.max(0, nextStart - Date.now());
      nextStart = Math.max(Date.now(), nextStart) + interval;
      await new Promise((r) => setTimeout(r, wait));
      let response;
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent":
              "specta-website-reference/1.0 (https://github.com/specta-rs/website)",
          },
          signal: AbortSignal.timeout(60000),
        });
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await response.arrayBuffer();
        await new Promise((r) =>
          setTimeout(
            r,
            Math.max(
              Number(response.headers.get("retry-after") ?? 0) * 1000,
              1000 * 2 ** attempt,
            ),
          ),
        );
        continue;
      }
      const body = Buffer.from(await response.arrayBuffer());
      const saved = {
        status: response.status,
        url: response.url,
        body: body.toString("base64"),
      };
      if (response.ok || response.status === 404) {
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cache, JSON.stringify(saved));
      }
      return { ...saved, body };
    }
  };
}

export async function generate({
  outputDir,
  cacheDir,
  offline = false,
  refresh = false,
  concurrency = 3,
  selected = crates,
}) {
  const download = createDownloader({ cacheDir, offline, refresh });
  const packages = [];
  for (const [name, project] of selected) {
    const metadata = await download(`https://crates.io/api/v1/crates/${name}`);
    if (metadata.status !== 200)
      throw new Error(`crates.io ${name}: HTTP ${metadata.status}`);
    const releases = JSON.parse(metadata.body);
    const pkg = {
      id: `rust-${name}`,
      name,
      project,
      language: "rust",
      defaultVersion: "",
      versions: [],
    };
    const versions = releases.versions.toSorted((a, b) =>
      compareVersions(a.num, b.num),
    );
    let cursor = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursor < versions.length) {
          const release = versions[cursor++];
          const version = release.num;
          const url = `https://docs.rs/${name}/${version}/${name.replaceAll("-", "_")}/`;
          const entry = {
            version,
            url,
            ...(release.yanked ? { yanked: true } : {}),
          };
          const json = await download(
            `https://docs.rs/crate/${name}/${version}/json.gz`,
          );
          const all = await download(`${url}all.html`);
          let symbols, source;
          const htmlSymbols =
            all.status === 200 ? parseAllHtml(all.body.toString(), url) : [];
          if (json.status === 200) {
            const bytes =
              json.body[0] === 0x1f && json.body[1] === 0x8b
                ? gunzipSync(json.body)
                : json.body;
            symbols = parseRustdoc(
              JSON.parse(bytes.toString()),
              url,
              htmlSymbols,
            );
            // Rustdoc JSON omits some inlined reexports (notably proc macros).
            // Only fill gaps from this crate's actual published item list; never
            // enumerate the JSON dependency index or invent an external URL.
            const missing = htmlSymbols.filter(
              (s) =>
                !symbols.some(
                  (existing) =>
                    existing.name === s.name && existing.kind === s.kind,
                ),
            );
            for (const symbol of missing) {
              const page = await download(symbol.url);
              if (page.status !== 200)
                throw new Error(
                  `rustdoc reexport ${symbol.url}: HTTP ${page.status}`,
                );
              symbols.push(...parseItemHtml(page.body.toString(), symbol));
            }
            source = "rustdoc-json";
          } else if (json.status !== 404)
            throw new Error(
              `rustdoc JSON ${name}@${version}: HTTP ${json.status}`,
            );
          else if (all.status === 200 && !all.url.includes("/crate/")) {
            const archive = await download(
              `https://docs.rs/crate/${name}/${version}/download`,
            );
            const pages =
              archive.status === 200
                ? readHtmlArchive(archive.body, name.replaceAll("-", "_"))
                : undefined;
            symbols = [];
            for (const symbol of htmlSymbols) {
              const archived = pages?.[symbol.url.slice(url.length)];
              if (archived !== undefined)
                symbols.push(...parseItemHtml(archived, symbol));
              else {
                const page = await download(symbol.url);
                if (page.status !== 200)
                  throw new Error(
                    `rustdoc item ${symbol.url}: HTTP ${page.status}`,
                  );
                symbols.push(...parseItemHtml(page.body.toString(), symbol));
              }
            }
            symbols.push(...(await discoverModules(url, pages, download)));
            source = "rustdoc-html";
          } else if (all.status !== 404 && all.status !== 200)
            throw new Error(
              `rustdoc HTML ${name}@${version}: HTTP ${all.status}`,
            );
          if (symbols?.length) {
            const data = `/reference/rust/${pkg.id}/${version}.json`;
            const path = join(outputDir, pkg.id, `${version}.json`);
            await mkdir(dirname(path), { recursive: true });
            symbols.sort(
              (a, b) =>
                a.name.localeCompare(b.name, "en") ||
                a.kind.localeCompare(b.kind, "en"),
            );
            await writeFile(path, JSON.stringify({ symbols, source }) + "\n");
            entry.data = data;
          } else {
            const failedBuild = all.body
              .toString()
              .includes(`docs.rs failed to build ${name}-${version}`);
            entry.unavailable = failedBuild
              ? "docs.rs could not build documentation for this release."
              : all.status === 404 || all.url.includes("/crate/")
                ? "Documentation is unavailable on docs.rs for this release."
                : "No public API items were published in the docs.rs build.";
          }
          pkg.versions.push(entry);
          console.log(
            `${name}@${version}: ${symbols?.length ?? 0} symbols (${source ?? "unavailable"})`,
          );
        }
      }),
    );
    pkg.versions.sort((a, b) => compareVersions(a.version, b.version));
    pkg.defaultVersion =
      pkg.versions.find((v) => v.data && !v.yanked)?.version ??
      releases.crate.default_version;
    packages.push(pkg);
  }
  await mkdir(dirname(outputDir), { recursive: true });
  await writeFile(
    `${outputDir}.json`,
    JSON.stringify({ packages }, null, 2) + "\n",
  );
  return { packages };
}

function value(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  await generate({
    outputDir: join(root, "public/reference/rust"),
    cacheDir: value("--cache-dir") ?? join(root, ".reference-cache/rust"),
    offline: process.argv.includes("--offline"),
    refresh: process.argv.includes("--refresh"),
    concurrency: Math.max(1, Math.min(4, Number(value("--concurrency") ?? 3))),
    selected: value("--crate")
      ? crates.filter(([name]) => name === value("--crate"))
      : crates,
  });
}
