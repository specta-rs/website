import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const sourceArg = process.argv.indexOf("--source");
const targetArg = process.argv.indexOf("--target");
const refArg = process.argv.indexOf("--ref");
const source = path.resolve(
  sourceArg === -1 ? "../besu/docs" : process.argv[sourceArg + 1],
);
const target = path.resolve(
  targetArg === -1
    ? path.join(process.cwd(), "content/docs/besu")
    : process.argv[targetArg + 1],
);
const ref = refArg === -1 ? "main" : process.argv[refArg + 1];

const skip = new Set(["favicon.ico", "favicon.svg"]);

/**
 * The sidebar follows the guide's own reading order rather than the filesystem.
 * `docs/README.md` groups the pages by task; this mirrors it, and anything a
 * future page is not listed under still shows up in its section, sorted, or in
 * "Other" when it sits outside every section.
 */
const sections = [
  [
    "Get started",
    ["get-started/sqlite", "get-started/postgresql", "get-started/mysql"],
  ],
  [
    "Schema",
    [
      "schema/declaration",
      "schema/relations",
      "schema/indexes-constraints",
      "schema/views",
      "schema/sequences",
      "schema/schemas",
      "schema/rls",
      "schema/extensions",
      "schema/column-types/postgresql",
      "schema/column-types/mysql",
      "schema/column-types/sqlite",
    ],
  ],
  [
    "Queries",
    [
      "queries/select",
      "queries/insert",
      "queries/update",
      "queries/delete",
      "queries/operators",
      "queries/joins",
      "queries/aliases",
      "queries/comments",
      "queries/sql",
      "queries/query-utils",
    ],
  ],
  [
    "Advanced",
    [
      "advanced/transactions",
      "advanced/batch-api",
      "advanced/ctes",
      "advanced/subqueries",
      "advanced/set-operations",
      "advanced/generated-columns",
      "advanced/dynamic-query-building",
      "advanced/custom-types",
      "advanced/seeding",
      "advanced/cache",
      "advanced/read-replicas",
    ],
  ],
  [
    "Connect",
    [
      "connect/overview",
      "connect/sqlite",
      "connect/postgresql",
      "connect/mysql",
    ],
  ],
  [
    "Migrations",
    [
      "migrations/overview",
      "migrations/pull",
      "migrations/generate",
      "migrations/push",
      "migrations/migrate",
      "migrations/check",
      "migrations/custom",
      "migrations/studio",
      "migrations/config",
    ],
  ],
  [
    "Reference",
    ["overview", "comparison", "drivers", "performance", "architecture"],
  ],
];

/**
 * A section header repeats the page's own title where both would read the same
 * ("Connect" over an item called "Connect", or a second "Overview" beside the
 * index). The upstream heading is still right for a reader on GitHub, so only
 * the sidebar label changes.
 */
const labels = {
  "connect/overview": "Overview",
  overview: "What Besu is",
};

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, relative = "") {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory())
      files.push(...(await walk(path.join(dir, entry.name), rel)));
    else files.push(rel);
  }
  return files;
}

function titleFromFilename(file) {
  return path
    .basename(file, ".md")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rewriteLinks(text, file) {
  return text.replace(
    /(\[[^\]]*\]\()([^)\s]+)(\))/g,
    (_match, prefix, href, suffix) => {
      if (/^(?:[a-z]+:|\/|#)/i.test(href)) return `${prefix}${href}${suffix}`;

      const [rawPath, hash] = href.split("#", 2);
      if (!rawPath) return `${prefix}${href}${suffix}`;
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), rawPath),
      );

      // Anything that climbs out of `docs/` is a crate or a repository file:
      // the site does not have a page for it, so point at GitHub.
      if (resolved.startsWith("..")) {
        const repoPath = resolved.replace(/^(?:\.\.\/)+/, "");
        const kind = path.posix.extname(repoPath) ? "blob" : "tree";
        return `${prefix}https://github.com/specta-rs/besu/${kind}/main/${repoPath}${
          hash ? `#${hash}` : ""
        }${suffix}`;
      }

      if (resolved === "README.md")
        return `${prefix}/docs/besu${hash ? `#${hash}` : ""}${suffix}`;
      if (rawPath.endsWith(".md")) {
        return `${prefix}${rawPath.slice(0, -3)}${hash ? `#${hash}` : ""}${suffix}`;
      }
      return `${prefix}${href}${suffix}`;
    },
  );
}

function editUrl(file) {
  return `https://github.com/specta-rs/besu/blob/${ref}/docs/${file}`;
}

function withEditUrl(body, file) {
  const url = editUrl(file);
  if (!body.startsWith("---\n")) return body;

  const end = body.indexOf("\n---\n", 4);
  if (end === -1) return body;
  const frontmatter = body.slice(4, end);
  if (/^editUrl:/m.test(frontmatter)) return body;
  return `---\n${frontmatter}\neditUrl: ${JSON.stringify(url)}${body.slice(end)}`;
}

function prepareMarkdown(text, file) {
  let body = text
    .replace(/\r\n?/g, "\n")
    .replace(/^```([a-z0-9_+-]+),([^\s]+)/gim, "```$1 $2");
  if (body.startsWith("---\n"))
    return rewriteLinks(withEditUrl(body, file), file);

  const heading = body.match(/^#\s+(.+)\n+/);
  let title = heading?.[1]?.trim() ?? titleFromFilename(file);
  if (heading) body = body.slice(heading[0].length);
  if (file === "README.md") title = "Besu";

  const frontmatter = ["---", `title: ${JSON.stringify(title)}`];
  if (file === "README.md") {
    frontmatter.push(
      `description: ${JSON.stringify("A typesafe, async, database-agnostic SQL query builder for Rust.")}`,
    );
  }
  frontmatter.push(`editUrl: ${JSON.stringify(editUrl(file))}`, "---", "");
  return rewriteLinks(`${frontmatter.join("\n")}\n${body}`, file);
}

function sideMeta(files) {
  const markdown = files
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => file.slice(0, -3));

  const entries = [{ type: "file", name: "index", label: "Overview" }];
  const used = new Set(["index"]);

  for (const [label, order] of sections) {
    const available = new Set(markdown.filter((file) => !used.has(file)));
    // A page belongs to this section when it is one of the listed pages or
    // sits under one of the section's own prefixes.
    const prefixes = new Set(order.map((file) => file.split("/")[0]));
    const ordered = order.filter((file) => available.has(file));
    const rest = [...available]
      .filter(
        (file) => !order.includes(file) && prefixes.has(file.split("/")[0]),
      )
      .toSorted();
    if (ordered.length === 0 && rest.length === 0) continue;

    entries.push({ type: "section-header", label });
    for (const file of [...ordered, ...rest]) {
      entries.push(
        labels[file] ? { type: "file", name: file, label: labels[file] } : file,
      );
      used.add(file);
    }
  }

  const other = markdown.filter((file) => !used.has(file)).toSorted();
  if (other.length > 0) {
    entries.push({ type: "section-header", label: "Other" });
    for (const file of other) {
      entries.push(
        labels[file] ? { type: "file", name: file, label: labels[file] } : file,
      );
    }
  }

  // Source and registry links sit at the bottom of the sidebar, matching the
  // other projects.
  entries.push(
    {
      type: "custom-link",
      label: "GitHub",
      link: "https://github.com/specta-rs/besu",
      icon: "/assets/icons/github.svg",
    },
    {
      type: "custom-link",
      label: "crates.io",
      link: "https://crates.io/crates/besu",
      icon: "/assets/icons/crates-io.png",
    },
  );

  return `${JSON.stringify(entries, null, 2)}\n`;
}

if (!(await exists(source))) {
  console.error(`Besu docs source not found: ${source}`);
  process.exit(1);
}
if (!target.includes(`${path.sep}content${path.sep}docs${path.sep}`)) {
  console.error(`Refusing to write outside content/docs: ${target}`);
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

const files = await walk(source);
for (const file of files) {
  if (skip.has(file)) continue;
  const destination = path.join(
    target,
    file === "README.md" ? "index.md" : file,
  );
  await mkdir(path.dirname(destination), { recursive: true });

  if (file.endsWith(".md")) {
    const text = await readFile(path.join(source, file), "utf8");
    await writeFile(destination, prepareMarkdown(text, file));
  } else {
    await writeFile(destination, await readFile(path.join(source, file)));
  }
}

const written = await walk(target);
await writeFile(path.join(target, "_meta.json"), sideMeta(written));

const missingEditLink = [];
for (const doc of written.filter((file) => file.endsWith(".md"))) {
  const text = await readFile(path.join(target, doc), "utf8");
  if (
    !/^editUrl: "https:\/\/github\.com\/specta-rs\/besu\/blob\//m.test(text)
  ) {
    missingEditLink.push(doc);
  }
}
if (missingEditLink.length > 0) {
  console.error(
    `Besu docs without a Besu editUrl: ${missingEditLink.join(", ")}`,
  );
  process.exit(1);
}

console.log(`Synced ${written.length} files from ${source} to ${target}`);
