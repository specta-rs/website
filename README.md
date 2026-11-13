# Specta website

The website for the Specta ecosystem, built with [Rspress](https://rspress.rs).

## Development

```bash
pnpm install
pnpm dev
```

`pnpm build` builds the site, `pnpm start` previews it, and `pnpm deploy` publishes it.

Docs live in `content/docs/` and the landing page in `content/index.tsx`. Don't edit the Gurafi,
FSK or Besu docs directly — they're synced from their repositories with
`pnpm docs:sync:<project>`.
