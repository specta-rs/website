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

`rspc`'s TypeScript packages have a **TypeScript API** section in the sidebar, with
one page per `@rspc/*` package. Every page documents one exact release and carries a
version switcher; symbols show the published signature and link to their source.

Symbols are ordinary documentation pages, so they appear in site search,
`llms.txt` and the Markdown endpoints alongside the handwritten guides. Only the
release each page documents is listed in the sidebar and indexed; older releases are
reachable from the version switcher and are excluded from search so one symbol cannot
match dozens of times.

The machine-readable snapshots live in `reference/typescript.json` and
`reference/typescript/`, and the generated pages and bundled catalog are written from
them by `scripts/reference/pages.mjs`, which runs before `dev`, `build`, `typecheck`
and `postinstall`. Generated pages are not committed. Normal development, CI and
Cloudflare builds therefore need no registry access.

Refresh the data with Node 22.18+ and `tar` installed:

```bash
pnpm reference:sync
pnpm test
pnpm format
```

Review and commit the changed snapshots with the code. Registry discovery lists
historical releases even when they have no extractable documentation. Those versions
show an explanation and link to their original source instead of silently substituting
another release. Downloaded inputs are cached locally; refreshing mutable registry
metadata discovers new releases. The generator uses an isolated TypeScript 5 compiler
API because the website's TypeScript 7 package does not expose that API.

## Sponsors

Development is funded by sponsors. Direct sponsors ([Flight Science](https://www.flightscience.ai), [CrabNebula](https://crabnebula.dev)) are listed in [`src/lib/sponsors.ts`](./src/lib/sponsors.ts), alongside the GitHub Sponsors list fetched at build time when `GITHUB_TOKEN` is set.

[Become a sponsor](https://github.com/sponsors/oscartbeaumont) to support the project.
