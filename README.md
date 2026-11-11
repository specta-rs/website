# Specta website

The website for the Specta ecosystem, built with [Rspress](https://rspress.rs).

## Development

```bash
pnpm install
pnpm dev
```

`pnpm build` writes the static site to `doc_build/`, `pnpm start` serves it, and `pnpm deploy` deploys it with Wrangler.

Content lives in `content/`: documentation is under `content/docs/` and the landing page is `content/index.tsx`. Gurafi docs are synced from the [Gurafi repository](https://github.com/specta-rs/gurafi) by a scheduled workflow, so don't edit `content/docs/gurafi` directly.

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

## Sponsors

Development is funded by sponsors. [Become a sponsor](https://github.com/sponsors/oscartbeaumont) to support the project.
