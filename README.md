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

## Sponsors

Development is funded by sponsors. Direct sponsors ([Flight Science](https://www.flightscience.ai), [CrabNebula](https://crabnebula.dev)) are listed in [`src/lib/sponsors.ts`](./src/lib/sponsors.ts), alongside the GitHub Sponsors list fetched at build time when `GITHUB_TOKEN` is set.

[Become a sponsor](https://github.com/sponsors/oscartbeaumont) to support the project.
