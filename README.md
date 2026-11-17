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
separate token per environment:

```bash
gh secret set CLOUDFLARE_API_TOKEN --env production
gh secret set CLOUDFLARE_ACCOUNT_ID --env production
gh secret set CLOUDFLARE_API_TOKEN --env preview
gh secret set CLOUDFLARE_ACCOUNT_ID --env preview
```

The token needs **Workers Scripts: Edit** for the account; resolving the
`specta.dev` custom domain may also need **Zone: Read** (or **Workers Routes:
Edit** if route patterns are added). Cloudflare permissions should be scoped to
the smallest account and zone access that works.

The submodule update workflows open a pull request instead of pushing to `main`,
so merges trigger CI and deployment. The organization does not let workflows open
pull requests with the repository token, so `DOCS_SYNC_TOKEN` is required: a
fine-grained PAT with contents and pull request write access for this repository.
Using a PAT also makes CI and previews run on those update PRs.

The `main` ruleset requires pull requests and a passing `build` check, with no
required approvals, and blocks force pushes and deletion. The `production`
environment allows deployments from `main` only and requires a reviewer. If
required approvals are added to the ruleset, keep the organization setting that
lets workflows create and approve pull requests disabled, or replace the PAT flow
with a separate reviewer.
