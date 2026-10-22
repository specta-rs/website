import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript-api";
import { readFile } from "node:fs/promises";
import { sourceSnapshots } from "./typescript-snapshots.mjs";
import { declarationEntrypoints, parseExports } from "./typescript-parser.mjs";

const options = { sourceUrl: "https://example.test/package/1.0.0" };

test("resolves public aliases, star exports, overloads and docs without private declarations", () => {
  const files = {
    "index.d.ts":
      'export { Client as RenamedClient } from "./client"; export * from "./other";',
    "client.d.ts":
      "/** A client. */ export interface Client<T> { request(input: T): Promise<T>; } interface Secret {}",
    "other.d.ts":
      "/** Runs the request. */ export declare function run(input: string): string; export declare function run(input: number): number;",
  };
  const symbols = parseExports(ts, files, { ".": "index.d.ts" }, options);
  assert.deepEqual(
    symbols.map((s) => s.name),
    ["RenamedClient", "run"],
  );
  assert.match(symbols[0].signature, /interface Client<T>/);
  assert.equal(symbols[0].description, "A client.");
  assert.match(symbols[1].signature, /input: string/);
  assert.match(symbols[1].signature, /input: number/);
});

test("finds conditional and wildcard subpath declaration entrypoints", () => {
  const files = {
    "dist/index.d.ts": "",
    "dist/extra.d.ts": "",
    "dist/tools/a.d.ts": "",
  };
  const entries = declarationEntrypoints(
    {
      exports: {
        ".": {
          import: { types: "./dist/index.d.ts", default: "./dist/index.js" },
        },
        "./extra": "./dist/extra.js",
        "./tools/*": { types: "./dist/tools/*.d.ts" },
      },
    },
    files,
  );
  assert.deepEqual(entries, {
    ".": "dist/index.d.ts",
    "./extra": "dist/extra.d.ts",
    "./tools/a": "dist/tools/a.d.ts",
  });
});

test("subpath identities stay qualified and unambiguous", () => {
  const symbols = parseExports(
    ts,
    { "extra.d.ts": "export type Result = string;" },
    { "./extra": "extra.d.ts" },
    options,
  );
  assert.equal(symbols[0].name, "extra:Result");
});

test("generated commands, events and mocks retain real property source", () => {
  const symbols = parseExports(
    ts,
    {
      "bindings.ts":
        'export const commands = { /** Greets. */ hello: (name: string) => invoke<string>("hello", { name }) }; export const mocks = { install: () => true };',
    },
    { ".": "bindings.ts" },
    options,
  );
  const command = symbols.find((s) => s.name === "commands.hello");
  assert.equal(command.kind, "function");
  assert.equal(command.description, "Greets.");
  assert.match(command.signature, /invoke<string>/);
  assert.ok(symbols.some((s) => s.name === "mocks.install"));
});

test("generated event properties include the real local factory, without inventing an export", () => {
  const symbols = parseExports(
    ts,
    {
      "bindings.ts":
        'export const events = { changed: makeEvent<string>("changed") }; function makeEvent<T>(name: string) { return { listen: (callback: (value: T) => void) => listen(name, callback) }; }',
    },
    { ".": "bindings.ts" },
    options,
  );
  assert.match(
    symbols.find((s) => s.name === "events.changed").signature,
    /listen: \(callback:/,
  );
  assert.ok(!symbols.some((s) => s.name === "makeEvent"));
});

test("nested declaration member documentation and links survive signature printing", () => {
  const symbols = parseExports(
    ts,
    {
      "index.d.ts": `
    export interface TRPCRequestOptions {
      /** Pass additional context to links */
      context?: Record<string, unknown>;
    }
    export interface ClientArgs {
      /** Configure a transformer. See {@link https://example.com/transformer}. */
      transformer?: unknown;
    }
  `,
    },
    { ".": "index.d.ts" },
    options,
  );
  assert.match(
    symbols.find((symbol) => symbol.name === "TRPCRequestOptions").signature,
    /Pass additional context to links/,
  );
  assert.match(
    symbols.find((symbol) => symbol.name === "ClientArgs").signature,
    /\{@link https:\/\/example.com\/transformer\}/,
  );
});

test("generated command signatures include transitive local result helper context", () => {
  const symbols = parseExports(
    ts,
    {
      "bindings.ts": `
    type CommandResult<T, E> = { status: "ok"; data: T } | { status: "error"; error: E };
    async function typedError<T, E>(result: Promise<T>): Promise<CommandResult<T, E>> {
      try { return { status: "ok", data: await result }; }
      catch (error) { return { status: "error", error: error as E }; }
    }
    export const commands = { plainError: () => typedError<string, number>(invoke("plain_error")) };
  `,
    },
    { ".": "bindings.ts" },
    options,
  );
  const signature = symbols.find(
    (symbol) => symbol.name === "commands.plainError",
  ).signature;
  assert.match(signature, /Referenced local context \(not public exports\)/);
  assert.match(signature, /async function typedError<T, E>/);
  assert.match(signature, /type CommandResult<T, E>/);
  assert.match(signature, /status: "error"/);
  assert.deepEqual(
    symbols.map((symbol) => symbol.name),
    ["commands", "commands.plainError"],
  );
});

test("generated event context includes conditional emit aliases without exporting private helpers", () => {
  const symbols = parseExports(
    ts,
    {
      "bindings.ts": `
    type EventEmit<T> = [T] extends [null] ? () => Promise<void> : (value: T) => Promise<void>;
    type EventEmitTo<T> = (target: string, ...args: Parameters<EventEmit<T>>) => Promise<void>;
    function makeEvent<T>(name: string) { return { emit: emit as EventEmit<T>, emitTo: emitTo as EventEmitTo<T> }; }
    export const events = { changed: makeEvent<string>("changed") };
  `,
    },
    { ".": "bindings.ts" },
    options,
  );
  const signature = symbols.find(
    (symbol) => symbol.name === "events.changed",
  ).signature;
  assert.match(signature, /function makeEvent<T>/);
  assert.match(signature, /type EventEmit<T>/);
  assert.match(signature, /type EventEmitTo<T>/);
  assert.deepEqual(
    symbols.map((symbol) => symbol.name),
    ["events", "events.changed"],
  );
});

test("local context never mislabels exports declared with an export list as private", () => {
  const symbols = parseExports(
    ts,
    {
      "index.d.ts":
        "interface PublicType { value: string; } interface UsesPublic { item: PublicType; } export { PublicType, UsesPublic };",
    },
    { ".": "index.d.ts" },
    options,
  );
  assert.ok(
    !symbols
      .find((symbol) => symbol.name === "UsesPublic")
      .signature.includes("not public exports"),
  );
});

test("real release artifacts retain previously omitted packages, nested docs and runtime type context", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../../reference/typescript.json", import.meta.url)),
  );
  const getArtifact = async (id, version) => {
    const release = catalog.packages
      .find((pkg) => pkg.id === id)
      ?.versions.find((item) => item.version === version);
    assert.ok(release?.data, `missing artifact: ${id}@${version}`);
    return JSON.parse(
      await readFile(new URL(`../../${release.data}`, import.meta.url)),
    );
  };
  const normi = catalog.packages.find((pkg) => pkg.id === "ts-rspc-normi");
  assert.equal(normi.versions.length, 2);
  const normiArtifact = await getArtifact(normi.id, "0.0.0-main-7c0a67c1");
  for (const name of ["Normalized", "NormiOptions"])
    assert.ok(normiArtifact.symbols.some((symbol) => symbol.name === name));
  const playground = catalog.packages.find(
    (pkg) => pkg.id === "ts-rspc-playground",
  );
  assert.equal(playground.versions.length, 2);
  assert.ok(
    playground.versions.every(
      (version) => version.unavailable && !version.data,
    ),
  );
  const client = await getArtifact("ts-rspc-client", "0.0.0-main-32fe3d8a");
  assert.match(
    client.symbols.find((symbol) => symbol.name === "TRPCRequestOptions")
      .signature,
    /Pass additional context to links/,
  );
  const clientArgs = client.symbols.find(
    (symbol) => symbol.name === "ClientArgs",
  ).signature;
  assert.match(clientArgs, /Data transformer/);
  assert.match(clientArgs, /https:\/\/trpc.io\/docs\/data-transformers/);
});

test("does not fall back to private declaration files behind an exports map", () => {
  assert.deepEqual(
    declarationEntrypoints(
      { types: "private.d.ts", exports: { "./extra": "./extra.js" } },
      { "private.d.ts": "" },
    ),
    {},
  );
});

test("supports published legacy root types alongside JavaScript-only export conditions", () => {
  assert.deepEqual(
    declarationEntrypoints(
      {
        types: "dist/types/index.d.ts",
        exports: {
          ".": {
            import: "./dist/esm/index.js",
            require: "./dist/cjs/index.js",
          },
        },
      },
      { "dist/types/index.d.ts": "" },
    ),
    { ".": "dist/types/index.d.ts" },
  );
});

test("source snapshots follow local TypeScript and TSX public re-exports", () => {
  const files = {
    "packages/example/src/index.ts":
      'export { View as PublicView } from "./view"; export * from "./types";',
    "packages/example/src/view.tsx":
      "export function View(props: { title: string }) { return <span>{props.title}</span>; } function PrivateView() {}",
    "packages/example/src/types.ts":
      "/** Source options. */ export interface Options { enabled: boolean; }",
  };
  const symbols = parseExports(
    ts,
    files,
    { ".": "packages/example/src/index.ts" },
    options,
  );
  assert.deepEqual(
    symbols.map((symbol) => symbol.name),
    ["Options", "PublicView"],
  );
  assert.match(symbols[1].signature, /<span>/);
  assert.equal(symbols[0].description, "Source options.");
});

test("unreleased snapshot artifacts are pinned and cannot masquerade as npm releases", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../../reference/typescript.json", import.meta.url)),
  );
  for (const snapshot of sourceSnapshots) {
    assert.match(snapshot.commit, /^[a-f0-9]{40}$/);
    const pkg = catalog.packages.find((item) => item.id === snapshot.id);
    assert.ok(pkg);
    const version = pkg.versions.find(
      (item) => item.version === `unreleased-${snapshot.commit.slice(0, 12)}`,
    );
    assert.ok(version);
    assert.equal(
      version.url,
      `${snapshot.repository}/tree/${snapshot.commit}/${snapshot.directory}`,
    );
    const artifact = JSON.parse(
      await readFile(new URL(`../../${version.data}`, import.meta.url)),
    );
    assert.equal(artifact.published, false);
    assert.equal(artifact.sourceCommit, snapshot.commit);
    assert.equal(artifact.sourceRepository, snapshot.repository);
    assert.equal(artifact.sourcePackageDirectory, snapshot.directory);
    assert.deepEqual(artifact.sourceEntrypoints, snapshot.entrypoints);
    assert.equal(artifact.sourceManifestName, "@rspc/query-core");
    assert.match(artifact.description, /not a published npm version/);
    for (const name of [
      "createTanstackQueryProxy",
      "createRSPCQueryUtils",
      "createQueryHookHelpers",
      "BaseOptions",
      "SubscriptionOptions",
      "Context",
      "KeyAndInputSkipToken",
      "HookOptions",
      "WrapQueryOptions",
      "WrapMutationOptions",
    ]) {
      assert.ok(
        artifact.symbols.some((symbol) => symbol.name === name),
        `missing pinned source export: ${name}`,
      );
    }
    assert.ok(
      !artifact.symbols.some((symbol) => symbol.name === "isSkipTokenInput"),
    );
    assert.ok(
      artifact.symbols.every((symbol) =>
        symbol.description.includes(snapshot.commit),
      ),
    );
  }
});

test("committed release catalog and every artifact satisfy the UI contract", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../../reference/typescript.json", import.meta.url)),
  );
  assert.ok(catalog.packages.length >= 11);
  for (const pkg of catalog.packages) {
    assert.ok(pkg.id.startsWith("ts-"));
    assert.equal(pkg.project, "rspc");
    assert.equal(pkg.language, "typescript");
    assert.ok(
      pkg.versions.some((version) => version.version === pkg.defaultVersion),
    );
    for (const version of pkg.versions) {
      assert.match(version.url, /^https:\/\//);
      if (!version.data) {
        assert.ok(version.unavailable);
        continue;
      }
      assert.equal(
        version.data,
        `reference/typescript/${pkg.id}/${version.version}.json`,
      );
      const artifact = JSON.parse(
        await readFile(new URL(`../../${version.data}`, import.meta.url)),
      );
      assert.ok(artifact.symbols.length > 0);
      const names = new Set();
      for (const symbol of artifact.symbols) {
        assert.ok(symbol.name);
        assert.ok(symbol.kind);
        assert.equal(typeof symbol.description, "string");
        assert.ok(symbol.signature);
        assert.equal(symbol.url, undefined);
        assert.ok(!names.has(symbol.name), `duplicate symbol: ${symbol.name}`);
        names.add(symbol.name);
      }
    }
  }
});
