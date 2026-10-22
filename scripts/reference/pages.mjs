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

/** Directory a project's TypeScript reference lives in. */
export const referenceFolder = "typescript-api";

// `rust-api` was the earlier Rust reference; it is cleared so a checkout that
// still has it does not keep serving pages that are no longer generated.
const clearedFolders = [referenceFolder, "rust-api"];

// Sections a package page lists, in reading order. A kind outside this list
// still appears, under "Other".
const sections = [
  ["namespace", "Namespaces"],
  ["class", "Classes"],
  ["interface", "Interfaces"],
  ["type", "Type aliases"],
  ["function", "Functions"],
  ["variable", "Variables"],
  ["enum", "Enums"],
  ["property", "Properties"],
  ["export", "Re-exports"],
];

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

/** Group symbols by kind, in the reading order the sections list defines. */
export function groupSymbols(symbols) {
  const known = new Map(sections);
  const buckets = new Map(sections.map(([, title]) => [title, []]));
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
  const base = `/docs/${pkg.project}/${referenceFolder}/${pkg.id}`;
  return version === home ? base : `${base}/${version}`;
}

// Signatures here are previews, and a highlighted code block plus its copy
// button costs kilobytes each. Inline code, and a plain <pre> for multi-line
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
  // An unpublished snapshot repeats per-symbol provenance that the page already
  // states once. Cut at the release's own marker rather than guessing the
  // sentence's shape: version strings contain periods.
  const marker =
    artifact.published === false ? "; not a published npm version." : undefined;
  const index = marker ? summary.indexOf(marker) : -1;
  if (marker && index !== -1 && index < 200)
    summary = summary.slice(index + marker.length).trim();
  return escapeMdx(summary);
}

function entry(symbol, artifact) {
  const lines = [`### \`${symbol.name}\``, ""];
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
  if (symbol.sourceUrl) lines.push(`[View source ↗](${symbol.sourceUrl})`, "");
  return lines.join("\n");
}

function body(symbols, artifact) {
  return groupSymbols(symbols)
    .map((section) => {
      const entries = section.symbols
        .map((symbol) => entry(symbol, artifact))
        .join("\n");
      return `## ${section.title}\n\n${entries}`;
    })
    .join("\n");
}

export function renderPackagePage({ pkg, version, artifact }) {
  const release = pkg.versions.find((item) => item.version === version);
  const home = homeVersion(pkg);
  const intro = artifact
    ? `Public exports of \`${pkg.name}\` at version \`${version}\`.`
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
title: ${JSON.stringify(pkg.name)}
description: ${JSON.stringify(
    `TypeScript API reference for ${pkg.name}, version ${version}.`,
  )}
generated: true${hidden ? "\nhidden: true" : ""}
---

<ReferenceHeader packageId=${JSON.stringify(pkg.id)} version=${JSON.stringify(version)} />

${[intro, ...notes, ...(artifact ? [body(artifact.symbols, artifact)] : [])]
  .filter((block) => block.trim())
  .join("\n\n")}
`;
}

async function main() {
  const { packages } = JSON.parse(
    await readFile(path.join(root, "reference/typescript.json"), "utf8"),
  );

  // Regenerate from scratch so a removed release, package or whole project
  // cannot linger. Every project directory on disk is cleared, not just the
  // ones the current catalog mentions.
  const projects = new Set(packages.map((pkg) => pkg.project));
  for (const directory of await readdir(contentDir, { withFileTypes: true })) {
    if (directory.isDirectory()) projects.add(directory.name);
  }
  for (const project of projects) {
    for (const folder of clearedFolders) {
      await rm(path.join(contentDir, project, folder), {
        recursive: true,
        force: true,
      });
    }
  }

  let pages = 0;
  // Versions whose symbols came from a pinned source commit rather than a
  // published archive, so the UI can say so without sniffing version strings.
  const unpublished = new Set();
  for (const pkg of packages) {
    const folder = path.join(contentDir, pkg.project, referenceFolder, pkg.id);
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
      if (artifact?.published === false)
        unpublished.add(`${pkg.id}@${release.version}`);
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
        { title: pkg.name, collapsible: false, pages: [] },
        null,
        2,
      )}\n`,
    );
  }

  for (const project of new Set(packages.map((pkg) => pkg.project))) {
    const listed = packages.filter((pkg) => pkg.project === project);
    const folder = path.join(contentDir, project, referenceFolder);
    await mkdir(folder, { recursive: true });
    await writeFile(
      path.join(folder, "meta.json"),
      `${JSON.stringify(
        { title: "TypeScript API", pages: listed.map((pkg) => pkg.id) },
        null,
        2,
      )}\n`,
    );
  }

  // Catalog for the version switcher. Symbol data stays in `reference/`; the
  // page route for each release and the snapshot flag are precomputed here so
  // the UI never has to re-derive routing or sniff version strings.
  await writeFile(
    catalogFile,
    `${JSON.stringify(
      {
        packages: packages.map((pkg) => {
          const home = homeVersion(pkg);
          return {
            ...pkg,
            homeVersion: home,
            versions: pkg.versions.map((release) => {
              // On this site when the release has a generated page: it either
              // has symbol data, or it is the version the page documents.
              const onSite = Boolean(release.data || release.version === home);
              return {
                ...release,
                onSite,
                href: onSite
                  ? pageUrl(pkg, release.version, home)
                  : release.url,
                ...(unpublished.has(`${pkg.id}@${release.version}`)
                  ? { unpublished: true }
                  : {}),
              };
            }),
          };
        }),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Generated ${pages} reference pages for ${packages.length} packages`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
