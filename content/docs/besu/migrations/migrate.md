---
title: "`besu migrate`"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/migrations/migrate.md"
---

`besu migrate` reads a directory of numbered SQL files and applies the ones the journal does
not list, in version order. With `--down` it reverts them instead.

```sh
Usage: besu migrate [OPTIONS] --database <DATABASE>

Options:
      --database <DATABASE>  The database to migrate, for example `postgres://user:pass@host/db` [env: DATABASE_URL=]
      --dir <DIR>            The directory holding `NNNN_name.sql` and `NNNN_name.down.sql` files [default: migrations]
      --down                 Revert migrations instead of applying them. On its own, reverts the newest one
      --to <VERSION>         The version to stop at when reverting; `0` reverts everything. Requires `--down`
  -h, --help                 Print help
```

`--database` also reads `DATABASE_URL`. `--to` is only valid with `--down`; clap rejects it
on its own.

## Applying

```sh
besu migrate --database postgres://user:pass@host/db --dir migrations
```

```text
applied 0001 create_users
applied 0002 add_email
applied 2 migration(s) to postgres
```

An up-to-date database prints `database is up to date` and exits zero. A directory with no
migration files prints `no migrations found in migrations` and returns before connecting, so
an unreachable database is not reported in that case.

## Reverting

```sh
# Revert the newest applied migration.
besu migrate --database postgres://user:pass@host/db --dir migrations --down

# Revert everything.
besu migrate --database postgres://user:pass@host/db --dir migrations --down --to 0

# Revert until the newest applied version is at most 2.
besu migrate --database postgres://user:pass@host/db --dir migrations --down --to 2
```

Only the journal knows which version is "one back", so `--down` without `--to` reverts the
newest row rather than the highest file in the directory. When there is nothing to revert it
prints `nothing to revert`.

Down statements run from the bottom of the file up, then the journal row is deleted. Write the
down file as the mirror of the up file — the inverse of each statement in the same position —
and the runner undoes them back to front. See [custom migrations](custom#down-migrations).

## What a run does

1. Reads the directory into `Migration` values, pairing each `NNNN_name.sql` with
   `NNNN_name.down.sql` by version.
2. Creates `_besu_migrations` if it is missing, and adds `down_checksum` to a journal written
   before that column existed.
3. Rejects two files with the same version.
4. Verifies the checksum of every already-applied migration, up and down.
5. Executes the statements of each missing migration, then inserts its journal row.

The whole run is one transaction: a failure rolls every pending migration back. On SQLite
that also keeps every statement on the same connection, which a schema change needs.

## Gotchas

- **MySQL commits DDL implicitly.** The transaction cannot roll a failed migration back
  there, so earlier statements of the run stay applied. PostgreSQL and SQLite roll back.
- **Reverting stops at the first migration without a down file.** It does not skip it and
  continue: the newest applied version is the one that gets undone, so an un-revertable
  newest migration means nothing can go back. The error names the version.
- **Renaming a migration changes its checksum.** The name is part of the digest, so editing
  the name part of an applied file is refused even if the SQL is untouched.
- **`--to` is not "migrate up to".** There is no way to apply only the first few pending
  files; the whole pending set runs.
- **There is no `--dry-run`.** To see what would change, run [`besu generate`](generate)
  against a copy, or `besu push --dry-run` for the schema-level difference.
- **Migrations are split on `;`.** The splitter understands quotes and `--` comments, not
  PostgreSQL dollar-quoting or `/* */` blocks, so a `DO $$ ... $$` body is cut in the middle.
  Put such a body in its own file with one statement, or run it outside the runner.
