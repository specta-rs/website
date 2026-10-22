# Specta website

Website for documenting Specta projects. Built using [Waku](https://waku.gg), [Fumadocs](https://www.fumadocs.dev) and [TailwindCSS](https://tailwindcss.com).

## Usage

```bash
pnpm i
pnpm dev
```

## Formatting and linting

Formatting is [oxfmt](https://oxc.rs/docs/guide/usage/formatter) and linting is [oxlint](https://oxc.rs/docs/guide/usage/linter). Both run over the MDX under `content/` as well.

```bash
pnpm format        # write
pnpm format:check  # verify
pnpm lint
```

`content/docs/rspc/*/integrations/axum.mdx` is excluded from oxfmt: it contains a multi-line MDX comment (`{/* ... */}`), and oxfmt rewrites the `*` in the comment delimiters (to `_` or `\*`), producing invalid MDX that fails to compile. Single-line comments are unaffected. Tracked upstream by the MDX formatter work in [oxc-project/oxc#24608](https://github.com/oxc-project/oxc/issues/24608); remove the exclusion once that is fixed.

## API reference

`/docs/reference` lets readers choose a project, package or crate, and version.
Rust results open the exact symbol on docs.rs. TypeScript results show public
exports from published declarations; Tauri Specta shows representative generated
bindings from each release's exact source commit, not an application-independent
command API. Unpublished packages use explicitly labeled, commit-pinned snapshots.

The catalogs and per-version symbol files live in `public/reference/` and are
checked in. The sync script also generates the bundled catalog and default-version
search index under `src/lib/reference-{catalog,index}.json`, keeping imports out
of Vite's public-asset directory. Normal development, CI, and Cloudflare builds
need no registry or docs.rs access. The browser loads only the selected release's
symbol file.
Site-wide search indexes each reference's default version; the reference page
can search historical versions without mixing duplicate releases into global
search results.

Refresh the data with Node 22.18+ and `tar` installed:

```bash
pnpm reference:sync
pnpm test
pnpm format
```

Review and commit the changed artifacts with the code. Registry discovery lists
historical releases even when they have no extractable documentation. Those
versions show an explanation and link to their original source instead of
silently substituting another release. Downloaded inputs are cached locally;
refreshing mutable registry metadata discovers new releases. The generators use
an isolated TypeScript 5 compiler API because the website's TypeScript 7 package
does not expose that API.

## Sponsors

Development is funded by sponsors. Direct sponsors ([Flight Science](https://www.flightscience.ai), [CrabNebula](https://crabnebula.dev)) are listed in [`src/lib/sponsors.ts`](./src/lib/sponsors.ts), alongside the GitHub Sponsors list fetched at build time when `GITHUB_TOKEN` is set.

[Become a sponsor](https://github.com/sponsors/oscartbeaumont) to support the project.
