# TypeScript API reference

Run `node scripts/reference/typescript.mjs` to regenerate committed static JSON, then
`node --test scripts/reference/typescript.test.mjs`. Generation alone uses the network;
the website and its build read committed files only. The generator caches upstream
metadata and archives under
`node_modules/.cache/reference-typescript`; `--refresh` refreshes release catalogs.
Immutable release archives remain cached. Requests run sequentially, retry temporary
failures, and identify the documentation generator.
Each request has a 30-second timeout. Exhausted network retries and incomplete
downloads stop generation instead of being recorded as permanently unavailable APIs.

The generator and offline tests use the isolated
`typescript-api@npm:typescript@5.9.3` development dependency. The website's TypeScript 7
package does not expose the legacy compiler API.

## Sources and scope

- Every npm version (including prereleases and CI releases) of the published `@rspc`
  client, react, react-query, solid, solid-query, svelte-query, query-core, tauri,
  normi and playground
  packages is cataloged. `@rspc/svelte` has no package or source directory and is not
  invented. `@rspc/tanstack-query` has no published npm package but has an explicitly
  pinned source snapshot (see below). Package export maps, including subpaths, select
  declaration entrypoints; older packages use `types`/`typings`/`main`.
  This package list is explicit rather than inferred from npm search; both normi
  releases have declarations, while both playground releases are cataloged as
  unavailable because their published archives contain no public type entrypoint.
- The compiler follows local re-exports and aliases, preserves overload declarations,
  generic types and JSDoc, including nested member comments and links in signatures.
  Declaration text is printed rather than reconstructing
  signatures from guesses. External dependencies are not installed or executed;
  signatures retain their published imported type names. Explicit re-exports from
  unavailable external dependencies retain the export declaration instead of a
  fabricated signature. Private declarations are not listed independently.
- All crates.io Tauri Specta releases are cataloged. `.cargo_vcs_info.json` identifies
  each release's **exact Git commit**. Committed TypeScript test snapshots, or example
  bindings when snapshots are absent, are extracted from that commit. No floating
  `main` examples are assigned to a release. Versions without recoverable fixtures
  are explicitly unavailable and have a source link.
- Tauri Specta output is **representative generated code**, not an npm package or a
  fixed API. Application-specific command/event/type names are labeled as such.
  Different fixtures exercise constants, error modes, namespaces, split files and
  mocks where the release provides them. Actual generated implementation source is
  preserved when no `.d.ts` exists; object members are independently searchable.
  Signatures also include transitively referenced local helpers and type aliases
  under a clearly marked non-public context section. This preserves command result
  unions (`typedError`) and event conditional `EventEmit`/`EventEmitTo` signatures
  without inventing public exports or concealing their real definitions.
  At generation time, the latest rc.26 release has no mock-output fixtures; later
  main-branch mocks are deliberately not attributed to a release.

## Unreleased source snapshots

`typescript-snapshots.mjs` pins full repository commits and actual public source
entrypoints. The `packages/tanstack-query` directory in rspc main is cataloged as
`@rspc/tanstack-query` with version `unreleased-30402a42a6a5`. Its manifest currently
declares `@rspc/query-core`; this mismatch is recorded in the artifact and every
symbol's description. This source-directory identity is not an npm publication claim.

Snapshots parse the actual source exports (including local `.ts`/`.tsx` re-exports),
preserving implementation bodies rather than inventing inferred declaration output.
All repository source files are available to the parser; private declarations remain
unlisted. Artifacts record `published: false`, the full commit URL, source directory,
source manifest name, and source entrypoints. Updating a snapshot requires an explicit
commit edit, never silently follows main, and never replaces a published version.

## Data contract

`public/reference/typescript.json` contains `{ packages: [...] }`. Each version points
to its artifact via `data`, or records an `unavailable` reason. Artifacts contain
`{ symbols: [...] }`; Tauri artifacts also record source version, commit, fixtures and
the representative-output caveat.

Symbol names include their subpath (`subpath:ExportName`), or fixture path for Tauri.
Nested object members append `.member`. Import `symbolAnchor` from
`scripts/reference/typescript-parser.mjs`, or use the exact equivalent:

```js
const anchor = `symbol-${encodeURIComponent(symbol.name)}`;
```

The symbol's `url` is already the internal version-aware documentation link, including
this anchor. The UI must set its element `id` to the encoded anchor string exactly.
