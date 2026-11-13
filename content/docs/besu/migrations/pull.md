---
title: "`besu pull`"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/migrations/pull.md"
---

`besu pull` reads a live database's schema into the JSON form of the schema IR. The file it
writes is what `besu push` and `besu generate` consume, so it is a schema snapshot rather
than a SQL dump.

```sh
Usage: besu pull [OPTIONS] --database <DATABASE>

Options:
      --database <DATABASE>  The database to read, for example `postgres://user:pass@host/db` [env: DATABASE_URL=]
      --out <OUT>            Where to write the snapshot. Defaults to standard output
  -h, --help                 Print help
```

`--database` also reads `DATABASE_URL`. Without `--out` the JSON goes to standard output.

## Running it

```sh
besu pull --database postgres://user:pass@host/db --out schema.json
# wrote 4 table(s) from postgres to schema.json
```

```sh
besu pull --database sqlite:app.db > schema.json
```

The output is `Schema` serialised with `serde_json`: tables, enum types, views and sequences
where the dialect has them. Empty lists are omitted, so a SQLite snapshot contains only tables.

```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "ty": "Int8", "nullable": false, "auto_increment": true, "primary_key": true, "unique": false }
      ]
    }
  ]
}
```

The exact fields are the ones in [the overview](overview#the-schema-ir).

## What it reads

- **Tables** in every non-system schema. The migration journal `_besu_migrations` is skipped.
- **Columns**, including nullability, identity, defaults, primary keys and single-column
  uniques.
- **Indexes, composite uniques, foreign keys and checks** where the driver can report them.
- **Enum types**, on PostgreSQL.
- **Views**, so the snapshot names them. The differ ignores them.

A table in the connection's `current_schema()` is written unqualified; a table anywhere else
carries its schema, because a table's identity is `(schema, name)`. See
[table schemas](../schema/schemas).

## What it cannot read

Introspection skips an object the IR cannot describe rather than reporting a lossy version of
it, because `push` would then try to drop or replace it:

- expression indexes and `INCLUDE` indexes;
- indexes behind a constraint, and exclusion constraints;
- triggers;
- a view whose definition the connected role cannot see;
- `CHECK` constraints on SQLite and MySQL;
- a partial index's predicate on SQLite and MySQL.

## Gotchas

- **A snapshot is not portable SQL.** It is the IR, with canonical type names and the
  dialect's own view definitions. Use `besu generate` to turn a difference into SQL.
- **`--out` overwrites the file.** There is no merge and no backup.
- **SQLite creates a missing database file.** Connecting with `create_if_missing` means a
  typo in the path produces an empty database and a snapshot with no tables, rather than an
  error.
- **The message counts tables only.** A database of views and no base tables reports
  `0 table(s)`, even though the snapshot contains the views.
- **There is no schema filter.** Every non-system schema is read, which on a shared database
  can be a lot of JSON.
- **Auto-increment hides the sequence.** A `SERIAL` column is written as `auto_increment` and
  its `nextval` default is dropped; see [sequences](../schema/sequences).
