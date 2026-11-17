# Specta website

The website for the Specta ecosystem, built with [Rspress](https://rspress.rs).

## Development

```bash
pnpm install
pnpm dev
```

`pnpm build` builds the site, `pnpm start` previews it, and `pnpm deploy` publishes it.

Docs live in `content/docs/` and the landing page in `content/index.tsx`.

## Deployment

Pushes to `main` run CI and, once it passes, deploy the built site to Cloudflare
Workers at [specta.dev](https://specta.dev). Pull requests from branches in this
repository get a Cloudflare Preview at a stable `pr-<number>` URL, which is
posted as a pull request comment and deleted when the pull request closes.
Forked pull requests are not deployed because workflow secrets are unavailable
to them.

Both workflows use the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
repository secrets. The token needs **Workers Scripts: Edit** for the account
and **Workers Routes: Edit** for the `specta.dev` zone.
