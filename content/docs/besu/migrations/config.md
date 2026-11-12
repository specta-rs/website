---
title: "Configuration"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/migrations/config.md"
---

There is no project file. Every command is configured by its flags, and the database is a
connection string passed with `--database` or read from `DATABASE_URL`. That is the whole
configuration surface.

> **Not supported yet.** A `besu.config.*` file, config discovery and per-environment
> profiles do not exist. See the [roadmap](../roadmap) and
> [Drizzle parity](../parity).

## The connection string

`--database` takes a URL. The scheme chooses the backend, and the rest is handed to that
backend's pool:

```sh
besu migrate --database sqlite:app.db
besu migrate --database sqlite://app.db
besu migrate --database postgres://user:pass@host/db
besu migrate --database postgresql://user:pass@host/db
besu migrate --database mysql://user:pass@host/db
```

| Scheme | Backend | Notes |
| --- | --- | --- |
| `sqlite` | SQLite | Opens a file, creating it if missing |
| `postgres`, `postgresql` | PostgreSQL | The URL is parsed by sqlx |
| `mysql` | MySQL | The URL is parsed by sqlx |

An unknown scheme fails before connecting:

```text
unsupported database scheme `mssql`; expected sqlite, postgres or mysql
```

TLS, socket paths and pool parameters are part of the URL, because the driver passes it
straight to sqlx. There are no CLI flags for them.

## Environment variables

`--database` is the only option with an environment fallback, and the only variable is
`DATABASE_URL`:

```sh
export DATABASE_URL=postgres://user:pass@host/db

besu pull --out schema.json
besu generate --schema schema.json --name add_email
besu migrate --dir migrations
```

An explicit flag beats the variable. In `--help` the variable is shown with its current value,
so `[env: DATABASE_URL=]` means it is unset.

`besu studio` reads it the same way, so a shell that already has `DATABASE_URL` set needs no
`--database` at all.

## Defaults

| Command | Required | Defaults |
| --- | --- | --- |
| `besu pull` | `--database` | `--out` writes to standard output |
| `besu push` | `--database`, `--schema` | none |
| `besu generate` | `--database`, `--schema` | `--out migrations`, `--name schema` |
| `besu migrate` | `--database` | `--dir migrations` |
| `besu studio` | `--database` | `--port 4983`, loopback only |

There is no flag for a snapshot path on `migrate`, no input directory for `generate` (it
diffs against the database), and no way to point the CLI at a named environment.

## What is not configurable

- **The dialect.** It comes from the URL scheme; there is no override.
- **The journal table name.** It is always `_besu_migrations`.
- **The statement splitter.** It is fixed, and its limits are described in
  [custom migrations](custom#statements).
- **Logging.** The CLI installs no subscriber, so there is no `RUST_LOG` behaviour to set;
  `besu studio` does install one.
- **Migration naming.** `generate` uses `NNNN_name.sql` and does not consult a template.

## Gotchas

- **A missing `DATABASE_URL` is a clap error, not a runtime error.** The command prints its
  usage and exits before any connection attempt.
- **`DATABASE_URL` is shared with everything else in the environment.** A shell that exports
  a production URL will use it for any `besu` command that omits `--database`.
- **A SQLite typo creates a database.** `sqlite:app.db` opens or creates the file, so a wrong
  path silently produces an empty database.
- **Defaults are relative to the working directory.** `--dir migrations` and `--out
  migrations` mean the directory below wherever you invoked the binary, not the crate root.
