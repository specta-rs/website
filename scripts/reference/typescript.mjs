import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript-api";
import { declarationEntrypoints, parseExports } from "./typescript-parser.mjs";
import { sourceSnapshots } from "./typescript-snapshots.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const cache = path.join(root, "node_modules/.cache/reference-typescript");
const output = path.join(root, "reference/typescript");
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
const refresh = process.argv.includes("--refresh");
class DownloadFailure extends Error {}
async function download(url, mutable = false) {
  const file = path.join(cache, createHash("sha256").update(url).digest("hex"));
  if (!refresh || !mutable) {
    try {
      return await readFile(file);
    } catch {}
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "rspc-reference-generator (https://rspc.dev)",
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (attempt === 3)
        throw new DownloadFailure(
          `Network request failed after four attempts: ${url}`,
          { cause: error },
        );
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if (response.ok) {
      const data = Buffer.from(
        await response.arrayBuffer().catch((error) => {
          throw new DownloadFailure(
            `Could not read complete source archive: ${url}`,
            { cause: error },
          );
        }),
      );
      await writeFile(file, data);
      return data;
    }
    if (response.status === 404) throw new Error(`Source not found: ${url}`);
    if (attempt === 3) throw new DownloadFailure(`${response.status}: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}
async function json(url, mutable = false) {
  return JSON.parse(await download(url, mutable));
}
async function archive(url) {
  const data = await download(url);
  const folder = path.join(
    cache,
    createHash("sha256").update(url).digest("hex") + "-files",
  );
  await mkdir(folder, { recursive: true });
  execFileSync("tar", ["-xz", "--strip-components=1", "-C", folder], {
    input: data,
  });
  return folder;
}
async function filesIn(dir, prefix = "") {
  const result = {};
  for (const entry of await readdir(path.join(dir, prefix), {
    withFileTypes: true,
  })) {
    const file = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, await filesIn(dir, file));
    else if (/\.(?:[cm]?ts|tsx|json)$/.test(file))
      result[file] = await readFile(path.join(dir, file), "utf8");
  }
  return result;
}
// An isolated, pinned compiler: the site's TypeScript 7 package has no legacy compiler API.
const packages = [];
async function artifact(pkg, version, files, entries, sourceUrl, extra = {}) {
  const symbols = parseExports(ts, files, entries, { sourceUrl });
  if (extra.published === false) {
    for (const symbol of symbols)
      symbol.description = [extra.description, symbol.description]
        .filter(Boolean)
        .join("\n\n");
  }
  if (pkg.project === "tauri-specta") {
    for (const symbol of symbols) {
      symbol.description = [
        `Representative generated output from Tauri Specta ${version}, source commit ${extra.sourceCommit}. Names and types are fixture-specific, not a fixed library API.`,
        symbol.description,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  }
  if (!symbols.length)
    throw new Error("No public declarations found in this published archive.");
  const data = `reference/typescript/${pkg.id}/${version}.json`;
  await mkdir(path.join(output, pkg.id), { recursive: true });
  await writeFile(
    path.join(root, data),
    JSON.stringify({ symbols, ...extra }, null, 2) + "\n",
  );
  return data;
}
for (const slug of [
  "client",
  "react",
  "react-query",
  "solid",
  "solid-query",
  "svelte",
  "svelte-query",
  "tanstack-query",
  "query-core",
  "tauri",
  "normi",
  "playground",
]) {
  let metadata;
  try {
    metadata = await json(`https://registry.npmjs.org/@rspc/${slug}`, true);
  } catch (error) {
    if (error.message.startsWith("Source not found:")) {
      console.log(`@rspc/${slug}: not published`);
      continue;
    }
    throw error;
  }
  const pkg = {
    id: `ts-rspc-${slug}`,
    name: `@rspc/${slug}`,
    project: "rspc",
    language: "typescript",
    defaultVersion: metadata["dist-tags"].latest,
    versions: [],
  };
  for (const [version, release] of Object.entries(
    metadata.versions,
  ).toReversed()) {
    const url = `https://www.npmjs.com/package/@rspc/${slug}/v/${version}`;
    try {
      const dir = await archive(release.dist.tarball);
      const files = await filesIn(dir);
      const manifest = JSON.parse(files["package.json"]);
      const entries = declarationEntrypoints(manifest, files);
      if (!Object.keys(entries).length)
        throw new Error(
          "The published npm archive has no declaration file at its declared public type entrypoints.",
        );
      const data = await artifact(pkg, version, files, entries, url);
      pkg.versions.push({ version, url, data });
    } catch (error) {
      if (error instanceof DownloadFailure) throw error;
      pkg.versions.push({ version, url, unavailable: error.message });
    }
  }
  console.log(
    `${pkg.name}: ${pkg.versions.filter((v) => v.data).length}/${pkg.versions.length}`,
  );
  packages.push(pkg);
}
for (const snapshot of sourceSnapshots) {
  const version = `unreleased-${snapshot.commit.slice(0, 12)}`;
  const sourceUrl = `${snapshot.repository}/tree/${snapshot.commit}/${snapshot.directory}`;
  const existing = packages.find((pkg) => pkg.id === snapshot.id);
  const pkg = existing || {
    id: snapshot.id,
    name: snapshot.name,
    project: "rspc",
    language: "typescript",
    defaultVersion: version,
    versions: [],
  };
  const repositoryFiles = await filesIn(
    await archive(
      `https://codeload.github.com/specta-rs/rspc/tar.gz/${snapshot.commit}`,
    ),
  );
  const manifest = JSON.parse(
    repositoryFiles[`${snapshot.directory}/package.json`],
  );
  for (const file of Object.values(snapshot.entrypoints)) {
    if (!(file in repositoryFiles))
      throw new Error(
        `Pinned source entrypoint is missing: ${sourceUrl}/${file}`,
      );
  }
  const description = `Unreleased source snapshot of ${snapshot.directory} at commit ${snapshot.commit}; not a published npm version. The directory is documented as ${snapshot.name}, but its source package.json declares ${manifest.name}. Signatures preserve actual public source, including implementation bodies; they are not fabricated declaration output.`;
  const data = await artifact(
    pkg,
    version,
    repositoryFiles,
    snapshot.entrypoints,
    sourceUrl,
    {
      description,
      published: false,
      sourceVersion: version,
      sourceCommit: snapshot.commit,
      sourceRepository: snapshot.repository,
      sourceUrl,
      sourcePackageDirectory: snapshot.directory,
      sourceManifestName: manifest.name,
      sourceEntrypoints: snapshot.entrypoints,
    },
  );
  pkg.versions.push({ version, url: sourceUrl, data });
  if (!existing) packages.push(pkg);
  console.log(
    `${pkg.name}: pinned ${version} (${manifest.name} source manifest)`,
  );
}
const crate = await json("https://crates.io/api/v1/crates/tauri-specta", true);
const pkg = {
  id: "ts-tauri-specta",
  name: "Tauri Specta generated bindings",
  project: "tauri-specta",
  language: "typescript",
  defaultVersion: crate.versions[0].num,
  versions: [],
};
for (const release of crate.versions) {
  const version = release.num;
  const url = `https://docs.rs/crate/tauri-specta/${version}/source/`;
  try {
    const dir = await archive(
      `https://static.crates.io/crates/tauri-specta/tauri-specta-${version}.crate`,
    );
    const vcs = JSON.parse(
      await readFile(path.join(dir, ".cargo_vcs_info.json"), "utf8"),
    );
    const commit = vcs.git.sha1;
    const repo = await archive(
      `https://codeload.github.com/specta-rs/tauri-specta/tar.gz/${commit}`,
    );
    const files = await filesIn(repo);
    const fixtures = Object.keys(files).filter((file) =>
      /^tests\/snapshots\/.+\.ts$/.test(file),
    );
    if (!fixtures.length)
      fixtures.push(
        ...Object.keys(files).filter((file) =>
          /^examples\/.+\/bindings[^/]*\.ts$/.test(file),
        ),
      );
    if (!fixtures.length)
      throw new Error(
        "No released generated TypeScript fixture is available in the exact release source.",
      );
    const entries = Object.fromEntries(
      fixtures.map((file) => [`./${file.replace(/\.ts$/, "")}`, file]),
    );
    const sourceUrl = `https://github.com/specta-rs/tauri-specta/tree/${commit}`;
    const data = await artifact(pkg, version, files, entries, sourceUrl, {
      description:
        "Representative generated output, not a fixed package API. Command, event, type and constant names come from release test fixtures or example Rust applications. Available helpers depend on builder configuration. Signatures below preserve actual generated source, including implementation bodies when no declaration file is published." +
        (fixtures.some((file) => /mock/i.test(file))
          ? " Mock fixtures are included."
          : " This exact release has no committed mock-output fixture; unreleased main-branch mock APIs are not attributed to it."),
      sourceVersion: version,
      sourceCommit: commit,
      sourceUrl,
      fixtures,
    });
    pkg.versions.push({ version, url: sourceUrl, data });
  } catch (error) {
    if (error instanceof DownloadFailure) throw error;
    pkg.versions.push({ version, url, unavailable: error.message });
  }
}
console.log(
  `${pkg.name}: ${pkg.versions.filter((v) => v.data).length}/${pkg.versions.length}`,
);
packages.push(pkg);
await writeFile(
  path.join(root, "reference/typescript.json"),
  JSON.stringify({ packages }, null, 2) + "\n",
);
