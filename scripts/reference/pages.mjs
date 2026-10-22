import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Generated reference pages are derived from the committed symbol snapshots in
// `reference/`. They are written into `content/docs` at build time so the pages
// flow through the normal documentation pipeline: sidebar, search, sitemap and
// Markdown endpoints all treat them like handwritten guides.

const root = path.resolve(import.meta.dirname, "../..");
const contentDir = path.join(root, "content/docs");
const catalogFile = path.join(root, "src/lib/reference-catalog.json");

/** Directory name a language's reference lives in, relative to a project. */
export const languageFolder = {
  rust: "rust-api",
  typescript: "typescript-api",
};

const sections = {
  rust: [
    ["mod", "Modules"],
    ["macro", "Macros"],
    ["derive", "Derive macros"],
    ["attr", "Attribute macros"],
    ["struct", "Structs"],
    ["enum", "Enums"],
    ["trait", "Traits"],
    ["fn", "Functions"],
    ["method", "Methods"],
    ["tymethod", "Trait methods"],
    ["associatedconstant", "Associated constants"],
    ["associatedtype", "Associated types"],
    ["constant", "Constants"],
    ["static", "Statics"],
    ["type", "Type aliases"],
    ["structfield", "Struct fields"],
    ["variant", "Enum variants"],
  ],
  typescript: [
    ["namespace", "Namespaces"],
    ["class", "Classes"],
    ["interface", "Interfaces"],
    ["type", "Type aliases"],
    ["function", "Functions"],
    ["variable", "Variables"],
    ["enum", "Enums"],
    ["property", "Properties"],
    ["export", "Re-exports"],
  ],
};

/**
 * MDX treats `<`, `>` and `{}` as markup, and a line starting with `#` as
 * structure. Documentation comments are prose, so neutralise both — but never
 * inside inline code, where entities are rendered literally.
 */
export function escapeMdx(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/(`+[^`]*`+)/g)
    .map((part) =>
      part.startsWith("`")
        ? part
        : part
            .replace(/[{}<>]/g, (character) => `&#${character.charCodeAt(0)};`)
            .replace(/^(\s*)(#{1,6})(\s)/gm, "$1\\$2$3"),
    )
    .join("")
    .trim();
}

/** Group symbols by kind, ordered by the language's conventional listing. */
export function groupSymbols(symbols, language) {
  const order = sections[language];
  const known = new Map(order);
  const buckets = new Map(order.map(([, title]) => [title, []]));
  for (const symbol of symbols) {
    const title = known.get(symbol.kind) ?? "Other";
    if (!buckets.has(title)) buckets.set(title, []);
    buckets.get(title).push(symbol);
  }
  return [...buckets]
    .map(([title, entries]) => ({ title, symbols: entries }))
    .filter((section) => section.symbols.length > 0);
}

/**
 * Version the package's page documents. The registry's newest tag may have no
 * extractable declarations, in which case the page shows the newest release
 * that does; the tag itself stays selectable from the version switcher.
 */
export function homeVersion(pkg) {
  const current = pkg.versions.find(
    (release) => release.version === pkg.defaultVersion,
  );
  if (current?.data) return pkg.defaultVersion;
  return (
    pkg.versions.find((release) => release.data)?.version ?? pkg.defaultVersion
  );
}

/** Page URL for a package, version-aware: the home version owns the folder. */
export function pageUrl(pkg, version, home = homeVersion(pkg)) {
  const base = `/docs/${pkg.project}/${languageFolder[pkg.language]}/${pkg.id}`;
  return version === home ? base : `${base}/${version}`;
}

// Signatures here are previews, and a highlighted code block plus its copy
// button costs kilobytes each: a crate with hundreds of symbols would ship a
// megabyte of chrome. Inline code, and a plain <pre> for multi-line
// declarations, keeps a whole package inside the browser's budget.
const signatureClassName =
  "not-prose my-3 overflow-x-auto rounded-lg border bg-fd-secondary/50 p-3 text-xs leading-relaxed";

/** Longest signature we render on a page; the source link carries the rest. */
const maxSignatureLength = 1000;

/**
 * Trim a long declaration at a line boundary. A single-line declaration is kept
 * whole however long it is: it costs one line, and truncating it would delete
 * the only copy of that release's signature.
 */
export function truncateSignature(signature) {
  if (signature.length <= maxSignatureLength) return signature;
  const lines = signature.split("\n");
  if (lines.length === 1) return signature;
  const kept = [];
  let length = 0;
  for (const line of lines) {
    if (length + line.length > maxSignatureLength) break;
    kept.push(line);
    length += line.length + 1;
  }
  if (kept.length === 0) kept.push(lines[0]);
  return `${kept.join("\n")}\n// … truncated, see the source link`;
}

function symbolSummary(symbol, artifact) {
  let summary = symbol.description ?? "";
  // Generated bindings repeat a per-symbol provenance sentence that the page
  // already states once, in the release's own wording.
  if (artifact.sourceCommit) {
    summary = summary.replace(/^Representative generated output[^.]*\.\s*/, "");
  }
  return escapeMdx(summary);
}

function entry(symbol, language, artifact) {
  const lines = [];
  if (language === "rust") {
    lines.push(`### [\`${symbol.name}\`](${symbol.url})`, "");
  } else {
    lines.push(`### \`${symbol.name}\``, "");
  }
  // JSON.stringify keeps braces, backticks and template literals intact.
  const signature = symbol.signature?.trim()
    ? truncateSignature(symbol.signature.trim())
    : undefined;
  if (signature) {
    lines.push(
      signature.includes("\n") || signature.includes("`")
        ? `<pre className="${signatureClassName}">{${JSON.stringify(signature)}}</pre>`
        : `\`${signature}\``,
      "",
    );
  }
  const summary = symbolSummary(symbol, artifact);
  if (summary) lines.push(summary, "");
  if (language === "typescript" && symbol.sourceUrl) {
    lines.push(`[View source ↗](${symbol.sourceUrl})`, "");
  }
  return lines.join("\n");
}

function description(symbols, language, artifact) {
  const shown = groupSymbols(symbols, language);
  return shown
    .map((section) => {
      const body = section.symbols
        .map((symbol) => entry(symbol, language, artifact))
        .join("\n");
      return `## ${section.title}\n\n${body}`;
    })
    .join("\n");
}

/**
 * Sidebar and page label. The project name is already in the breadcrumb, so the
 * generated bindings page does not need to repeat it.
 */
export function displayName(pkg) {
  return pkg.project === "tauri-specta" && pkg.language === "typescript"
    ? "Generated bindings"
    : pkg.name;
}

export function renderPackagePage({ pkg, version, artifact }) {
  const release = pkg.versions.find((item) => item.version === version);
  const language = pkg.language;
  const home = homeVersion(pkg);
  const title = displayName(pkg);
  const intro = artifact
    ? language === "rust"
      ? `API reference for the [\`${pkg.name}\`](${release.url}) crate at version \`${version}\`.`
      : `Public exports of \`${pkg.name}\` at version \`${version}\`.`
    : `No API documentation could be extracted for ${pkg.name}. ${
        release.unavailable ?? ""
      } The source link above points at this exact release.`.trim();
  const hidden = version !== home;
  const notes = [];
  if (hidden) {
    notes.push(
      `This page documents \`${version}\`. The [documented version](${pageUrl(pkg, home, home)}) is \`${home}\`.`,
    );
  }
  if (artifact?.description) notes.push(escapeMdx(artifact.description));
  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(
    `${language === "rust" ? "Rust" : "TypeScript"} API reference for ${title}, version ${version}.`,
  )}
generated: true${hidden ? "\nhidden: true" : ""}
---

<ReferenceHeader packageId=${JSON.stringify(pkg.id)} version=${JSON.stringify(version)} />

${[
  intro,
  ...notes,
  ...(artifact ? [description(artifact.symbols, language, artifact)] : []),
]
  .filter((block) => block.trim())
  .join("\n\n")}
`;
}

async function main() {
  const catalogs = [];
  for (const ecosystem of ["rust", "typescript"]) {
    const catalog = JSON.parse(
      await readFile(path.join(root, `reference/${ecosystem}.json`), "utf8"),
    );
    catalogs.push(...catalog.packages);
  }

  // Regenerate from scratch so a removed release, package or whole project
  // cannot linger. Every project directory on disk is cleared, not just the
  // ones the current catalogs mention.
  const projects = new Set(catalogs.map((pkg) => pkg.project));
  for (const directory of await readdir(contentDir, { withFileTypes: true })) {
    if (directory.isDirectory()) projects.add(directory.name);
  }
  for (const project of projects) {
    for (const folder of Object.values(languageFolder)) {
      await rm(path.join(contentDir, project, folder), {
        recursive: true,
        force: true,
      });
    }
  }

  let pages = 0;
  for (const pkg of catalogs) {
    const folder = path.join(
      contentDir,
      pkg.project,
      languageFolder[pkg.language],
      pkg.id,
    );
    const home = homeVersion(pkg);
    const documented = pkg.versions.filter((release) => release.data);
    // A package with no extractable declarations still gets a page, so the
    // sidebar entry explains the gap instead of 404ing.
    const versions = documented.length
      ? documented
      : pkg.versions.filter((release) => release.version === home);
    for (const release of versions) {
      const artifact = release.data
        ? JSON.parse(await readFile(path.join(root, release.data), "utf8"))
        : undefined;
      const file =
        release.version === home ? "index.mdx" : `${release.version}.mdx`;
      await mkdir(folder, { recursive: true });
      await writeFile(
        path.join(folder, file),
        renderPackagePage({ pkg, version: release.version, artifact }),
      );
      pages += 1;
    }
    // Only the page version is listed; other releases stay reachable from the
    // version switcher without filling the sidebar. An empty `pages` keeps the
    // index as the folder's own link instead of a duplicated child entry.
    await writeFile(
      path.join(folder, "meta.json"),
      `${JSON.stringify(
        { title: displayName(pkg), collapsible: false, pages: [] },
        null,
        2,
      )}\n`,
    );
  }

  for (const project of new Set(catalogs.map((pkg) => pkg.project))) {
    for (const language of ["rust", "typescript"]) {
      const packages = catalogs.filter(
        (pkg) => pkg.project === project && pkg.language === language,
      );
      if (!packages.length) continue;
      await mkdir(path.join(contentDir, project, languageFolder[language]), {
        recursive: true,
      });
      await writeFile(
        path.join(contentDir, project, languageFolder[language], "meta.json"),
        `${JSON.stringify(
          {
            title: language === "rust" ? "Rust API" : "TypeScript API",
            pages: packages.map((pkg) => pkg.id),
          },
          null,
          2,
        )}\n`,
      );
    }
  }

  // Catalog for the version switcher. Symbol data stays in `reference/`, and
  // the page version is precomputed so the header links agree with the files.
  await writeFile(
    catalogFile,
    `${JSON.stringify(
      {
        packages: catalogs.map((pkg) => ({
          ...pkg,
          homeVersion: homeVersion(pkg),
        })),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Generated ${pages} reference pages for ${catalogs.length} packages`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
