---
title: "Custom migrations"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/migrations/custom.md"
---

A generated migration covers the changes the differ can see. Everything else — a view, a
policy, an extension, a data backfill, a trigger — is written by hand, in the same directory
and the same format. The runner does not care where a file came from.

```text
migrations/
  0001_extensions.sql
  0001_extensions.down.sql
  0002_create_users.sql
  0002_create_users.down.sql
  0003_active_users.sql
  0003_active_users.down.sql
  0004_backfill_emails.sql
```

## Naming

`<version>_<name>.sql` is an up migration; `<version>_<name>.down.sql` is its down migration.

- The version is a signed 64-bit integer. Files are applied in ascending version order.
- The name is the rest of the stem, with underscores turned into spaces for the journal and
  the CLI's output, so `0004_backfill_emails` prints as `backfill emails`.
- The two halves are paired by version, not by name. A down file whose name differs from its
  up file still belongs to it.
- A `.down.sql` with no up file is an error when the directory is read:
  `… has no matching up migration`.
- A file whose stem does not start with an integer is skipped, not reported, so a mistyped
  version disappears from the run.
- Only files ending in `.sql` are read. Subdirectories are not walked.

A migration without a down file is valid; it cannot be reverted. A migration with a
down file but no up file is not.

## Statements

A file is split on `;`. The splitter understands:

- single-quoted, double-quoted and backtick-quoted spans, with a doubled quote as an escape;
- `--` line comments, whose semicolons are ignored.

It does not understand PostgreSQL dollar-quoting or `/* */` block comments. A `DO $$ … $$`
body containing a semicolon is split in the middle. Keep such a body in its own file with one
statement, or run it outside the runner.

A trailing statement without a semicolon is kept. An empty file produces no statements and is
still recorded in the journal.

## Checksums are append-only

Every migration is hashed with FNV-1a over its name, a direction marker and its statements.
The digest is 16 hexadecimal characters and is stored in the journal. Editing an applied
migration is refused before anything runs:

```text
migration 3 has been modified since it was applied (recorded checksum …, now …); migrations are append-only
```

The down half is hashed separately, so editing a `.down.sql` is refused the same way. Adding a
down file to a migration that was applied without one is allowed, because there is no recorded
down checksum to compare against. Renaming the file's name part also changes the checksum.

## Down migrations

Write the down file as the mirror of the up file: the inverse of each statement in the same
position. The runner executes the down statements from the bottom of the file up.

```sql
-- 0002_create_users.sql
CREATE TABLE users (id BIGINT PRIMARY KEY, email TEXT NOT NULL);
CREATE INDEX users_email_idx ON users (email);
```

```sql
-- 0002_create_users.down.sql
DROP TABLE users;
DROP INDEX users_email_idx;
```

The runner drops the index before the table because it reads the down file backwards. Writing
the undo steps in the order you want them to run is the mistake that makes a revert fail
halfway.

## Objects the IR cannot express

A migration is the only home for anything the differ does not model. The linked page has the
details and examples:

- [views](../schema/views) — `CREATE VIEW`, `CREATE OR REPLACE VIEW`, materialised views;
- [row-level security](../schema/rls) — `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`;
- [extensions](../schema/extensions) — `CREATE EXTENSION` and the types it adds;
- [sequences](../schema/sequences) — a standalone sequence and its `nextval` default.

The same applies to triggers and expression indexes. On SQLite a composite `UNIQUE` or a
`CHECK` cannot be added to an existing table at all, and on both SQLite and MySQL a `CHECK` is
not introspected. A data backfill belongs here too:

```sql
-- 0004_backfill_emails.sql
UPDATE users SET email = lower(email) WHERE email <> lower(email);
```

## Building a migration in code

`Migrator` is public, so a migration can be assembled without a file. This is useful for tests
and for a schema that ships inside a binary:

```rust
use besu::schema::{Migration, Migrator};

let mut migrator = Migrator::new();
migrator.push(Migration::from_sql(
    1,
    "create_users",
    "CREATE TABLE users (id BIGINT PRIMARY KEY)",
));
migrator.push(Migration::from_sql_pair(
    2,
    "add_email",
    "ALTER TABLE users ADD COLUMN email TEXT",
    Some("ALTER TABLE users DROP COLUMN email".to_owned()),
));

let applied = db.migrate(&migrator).await?;
```

## Gotchas

- **A checksum is a guard, not a plan.** It proves the file did not change; it does not prove
  the file is correct.
- **The journal is a table like any other.** Do not write to `_besu_migrations` by hand; the
  runner will believe you.
- **A failed down migration stops the revert.** The run is one transaction on PostgreSQL and
  SQLite, so the database is left as it was; on MySQL it may not be.
- **The version is the identity, not the name.** Two files with the same version are rejected
  at run time, even if their names differ.
- **A hand-written file is still split on `;`.** Keeping one statement per file avoids the
  dollar-quoting limit.
