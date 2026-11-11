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
  sourceArg === -1 ? "../gurafi/docs" : process.argv[sourceArg + 1],
);
const target = path.resolve(
  targetArg === -1
    ? path.join(process.cwd(), "content/docs/gurafi")
    : process.argv[targetArg + 1],
);
const ref = refArg === -1 ? "main" : process.argv[refArg + 1];

const skip = new Set(["favicon.ico", "favicon.svg"]);
const guideOrder = [
  "getting-started",
  "objects",
  "fields",
  "args",
  "context",
  "enums",
  "scalars",
  "inputs",
  "operations",
  "interfaces",
  "unions",
  "schema-builder",
  "using-plugins",
  "app-layout",
  "circular-references",
  "patterns",
  "nullability",
  "type-inference",
  "playground",
  "printing-schemas",
  "client-codegen",
  "troubleshooting",
  "writing-plugins",
  "non-goals",
];
const pluginOrder = [
  "add-graphql",
  "complexity",
  "dataloader",
  "directives",
  "errors",
  "mocks",
  "relay",
  "scope-auth",
  "simple-objects",
  "tracing",
  "validation",
];

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

      if (resolved.startsWith("..")) {
        const repoPath = resolved.replace(/^(?:\.\.\/)+/, "");
        const kind = path.posix.extname(repoPath) ? "blob" : "tree";
        return `${prefix}https://github.com/specta-rs/gurafi/${kind}/main/${repoPath}${
          hash ? `#${hash}` : ""
        }${suffix}`;
      }

      if (resolved === "README.md")
        return `${prefix}/docs/gurafi${hash ? `#${hash}` : ""}${suffix}`;
      if (rawPath.endsWith(".md")) {
        return `${prefix}${rawPath.slice(0, -3)}${hash ? `#${hash}` : ""}${suffix}`;
      }
      return `${prefix}${href}${suffix}`;
    },
  );
}

function editUrl(file) {
  return `https://github.com/specta-rs/gurafi/blob/${ref}/docs/${file}`;
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
  if (file === "README.md") title = "Gurafi";

  const frontmatter = ["---", `title: ${JSON.stringify(title)}`];
  if (file === "README.md") {
    frontmatter.push(
      `description: ${JSON.stringify("Rust crates for building GraphQL servers.")}`,
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

  const section = (label, order, prefix) => {
    const available = new Set(
      markdown
        .filter((file) => file.startsWith(`${prefix}/`))
        .map((file) => file.slice(prefix.length + 1)),
    );
    const ordered = order.filter((file) => available.has(file));
    const rest = [...available]
      .filter((file) => !order.includes(file))
      .toSorted();
    if (ordered.length === 0 && rest.length === 0) return;

    entries.push({ type: "section-header", label });
    for (const file of [...ordered, ...rest]) {
      entries.push(`${prefix}/${file}`);
      used.add(`${prefix}/${file}`);
    }
  };

  section("Guide", guideOrder, "guide");
  section("Plugins", pluginOrder, "plugins");
  section("Server", [], "server");
  if (markdown.includes("architecture")) {
    entries.push({ type: "section-header", label: "Reference" });
    entries.push("architecture");
    used.add("architecture");
  }

  const other = markdown
    .filter(
      (file) =>
        !used.has(file) && !file.includes("/") && file !== "architecture",
    )
    .toSorted();
  if (other.length > 0) {
    entries.push({ type: "section-header", label: "Other" });
    entries.push(...other);
  }

  return `${JSON.stringify(entries, null, 2)}\n`;
}

if (!(await exists(source))) {
  console.error(`Gurafi docs source not found: ${source}`);
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

console.log(`Synced ${written.length} files from ${source} to ${target}`);
