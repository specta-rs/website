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

Pushes to `main` run CI and, once the build passes, deploy the artifacts it
validated to Cloudflare Workers at [specta.dev](https://specta.dev). The deploy
job targets the `production` GitHub environment, which requires a reviewer, and
a failed smoke test rolls back to the previous deployment.

Pull requests from branches in this repository get a Cloudflare Preview at a
stable `pr-<number>` URL, posted as a pull request comment and deleted when the
pull request closes. Previews build in a secretless job, then deploy from an
artifact in a job that targets the `preview` environment. Forked pull requests
and Dependabot updates are not deployed because workflow secrets are unavailable
to them.

Actions are pinned to commit SHAs (Dependabot keeps them current). The
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets should live on the
`production` and `preview` environments rather than at repository scope, with a
separate token per environment. The token needs **Workers Scripts: Edit** for the
account; resolving the `specta.dev` custom domain may also need **Zone: Read**
(or **Workers Routes: Edit** if route patterns are added). Cloudflare permissions
should be scoped to the smallest account and zone access that works.

The submodule update workflows open a pull request instead of pushing to `main`,
so merges trigger CI and deployment. Pull requests opened with the repository
token do not trigger workflows; set the optional `DOCS_SYNC_TOKEN` secret
(a fine-grained PAT with contents and pull request write access) to get CI and
previews on those update PRs.
