# Specta website

Website for documenting Specta projects. Built with [Rspress](https://rspress.rs), [Tailwind CSS](https://tailwindcss.com), and a small Cloudflare Worker in front of the static output.

## Usage

```bash
pnpm i
pnpm dev
```

- `content/` is the Rspress document root. Markdown lives under `content/docs`, the landing page is `content/index.tsx`, and sidebar metadata is `_meta.json`.
- `theme/` contains the custom Rspress theme: the documentation header, project switcher, generated-reference heading treatment, and the Markdown/AI page actions.
- `worker/` handles PostHog proxying and Markdown content negotiation (`Accept: text/markdown`, `.mdx`, and old `/llms.mdx` URLs) before falling back to the static build.
- `scripts/reference/` generates the TypeScript API pages from the committed snapshots in `reference/`.
- `scripts/site-data.mjs` fetches sponsors and GitHub star counts for the landing page at build time. It writes `theme/site-data.json`, which is ignored by Git and recreated by the shared `prepare:content` step used by `dev`, `build`, `typecheck`, and `postinstall`.

## Project docs

Gurafi docs are sourced from the [`specta-rs/gurafi`](https://github.com/specta-rs/gurafi) Git submodule at `docs-sources/gurafi`.

- `.github/workflows/update-gurafi-submodule.yml` runs daily at 04:17 UTC and can be triggered manually with `workflow_dispatch`.
- It fetches the latest `main`, checks whether `docs/` changed, runs `scripts/sync-gurafi-docs.mjs`, and commits the updated submodule plus the generated `content/docs/gurafi` tree. The push triggers the normal CI and Cloudflare deploy.
- If Gurafi changed but `docs/` did not, the workflow exits without a commit.
- Generated project docs are committed so local builds, search indexing and deployments do not require submodule initialization. Do not edit `content/docs/gurafi` directly.

Required repository secret:

- `specta-rs/website`: `DOCS_SYNC_TOKEN` — a PAT with contents write access to this repository, used for checkout and the push so downstream CI and Cloudflare builds trigger.

To sync locally after `git submodule update --init docs-sources/gurafi`:

```bash
pnpm docs:sync:gurafi
```

## Formatting and linting

Formatting is [oxfmt](https://oxc.rs/docs/guide/usage/formatter) and linting is [oxlint](https://oxc.rs/docs/guide/usage/linter). Both run over the MDX under `content/` as well.

```bash
pnpm format        # write
pnpm format:check  # verify
pnpm lint
```

`content/docs/rspc/*/integrations/axum.mdx` is excluded from oxfmt: it contains a multi-line MDX comment (`{/* ... */}`), and oxfmt rewrites the `*` in the comment delimiters (to `_` or `\*`), producing invalid MDX that fails to compile. Single-line comments are unaffected. Tracked upstream by the MDX formatter work in [oxc-project/oxc#24608](https://github.com/oxc-project/oxc/issues/24608); remove the exclusion once that is fixed.

## Build outputs

`pnpm build` writes a static site to `doc_build/`, including:

- HTML for every page;
- a Markdown copy of every page (`*.md`) for the copy/open actions and LLM clients;
- `llms.txt` and `llms-full.txt` with hidden drafts and deprecated releases removed;
- `sitemap.xml` with the same visibility rules;
- an OpenGraph image per page under the existing `/docs/<page>/og.png` paths.

`pnpm start` serves that output locally. `pnpm deploy` builds and deploys the Worker plus `doc_build/` with Wrangler.

## API reference

`rspc`'s TypeScript packages have a **TypeScript API** section in the sidebar, with
one page per `@rspc/*` package. Every page documents one exact release and carries a
version switcher; symbols show the published signature and link to their source.

Symbols are ordinary documentation pages, so they appear in site search,
`llms.txt` and the Markdown copies alongside the handwritten guides. Only the
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
