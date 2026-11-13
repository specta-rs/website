---
title: "Migrations overview"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/migrations/overview.md"
---

A migration is the difference between the schema your Rust code declares and the schema a
live database has, written down as SQL. Both sides are the same `Schema` type, so the
difference can be computed rather than remembered: `push` applies it directly, and
`generate` writes it to a file for review.

## The schema IR

```rust
pub struct Schema {
    pub tables: Vec<Table>,
    pub enums: Vec<Enum>,
    pub views: Vec<View>,
    pub sequences: Vec<Sequence>,
}

pub struct Table {
    pub name: String,
    pub schema: Option<String>,
    pub columns: Vec<Column>,
    pub indexes: Vec<Index>,
    pub uniques: Vec<Unique>,
    pub foreign_keys: Vec<ForeignKey>,
    pub checks: Vec<Check>,
    pub comment: Option<String>,
}
```

A table's identity is `(schema, name)`. `Schema::sort` makes the order deterministic, so two
equivalent schemas produce the same DDL and the same JSON. Empty lists are omitted from the JSON.

What the differ manages:

- **Tables, enums and their `ALTER`s.** Including whole-row changes.
- **Views and sequences.** A view is compared by its definition text, after folding away the
  qualifiers and formatting a database adds; a changed one is `CREATE OR REPLACE` (or dropped and
  created, where the dialect has no `OR REPLACE`). A sequence is compared by all its options.
Three things produce a `Schema`; `diff` and `Ddl` consume it:

```text
#[derive(Table)]  ─┐
live database     ─┼──▶ Schema ──▶ diff ──▶ DDL ──▶ database
snapshot on disk  ─┘
```

- `Database::schema(tables)` and `Schema::from_defs(..)` build one from the derive's metadata.
- `Database::introspect()` reads a live database.
- `Schema::load(..)` reads a JSON snapshot.
- `diff` / `diff_with` produce `Change`s, and `Ddl` renders them.

## `push` or migration files

`push` is "introspect, diff, apply". It is safe to call on every boot because an up-to-date
schema produces no changes, and it is the shortest path from a struct to a table.

```rust
let result = db.push([users.def(), posts.def()]).await?;

if result.is_empty() {
    println!("already up to date");
} else {
    for statement in &result.statements {
        println!("{statement};");
    }
}
```

A destructive change, such as dropping a column, is refused unless you call
`push_destructive`. There is no journal, no checksum and no record of what ran: the database
is the state.

Migration files are the alternative for anything that matters. They are numbered, reviewed,
checked for edits and replayed in order, so a deployment does not depend on which process ran
first.

| | `push` | `migrate` |
| --- | --- | --- |
| Source of truth | the live database | numbered files |
| Destructive changes | refused unless asked | run as written |
| History | none | `_besu_migrations` |
| Edited after running | irrelevant | rejected by checksum |
| Transaction | one statement at a time | one transaction per run |

## The journal

The runner owns one table. It is created on first use and is excluded from introspection, so
it never appears in a diff or a generated migration.

```sql
CREATE TABLE IF NOT EXISTS _besu_migrations (
    version BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    down_checksum VARCHAR(64)
)
```

Each row records the version, the name and a 16-character FNV-1a digest of the migration's
name and statements. A down checksum is recorded when the migration has a down file. Editing
an applied migration is an error, because the digest no longer matches.

## The loop

1. **Declare.** Change the struct, or write SQL for something the derive cannot express.
2. **Generate.** Diff the live database against a snapshot and write a numbered file.
3. **Review.** Read the file. A generated migration is a proposal, not a decision.
4. **Migrate.** Apply the pending files in version order.

```sh
# 1. Emit a snapshot from the application.
#    Database::schema_snapshot([users.def(), posts.def()]) -> String

# 2. Write migrations/0004_add_email.sql from the difference.
besu generate --database postgres://user:pass@host/db \
    --schema schema.json --name add_email

# 3. Read migrations/0004_add_email.sql.

# 4. Apply it, and every other pending file.
besu migrate --database postgres://user:pass@host/db --dir migrations
```

## The commands

| Command | What it does |
| --- | --- |
| [`besu pull`](pull) | Read the live schema into a JSON snapshot |
| [`besu generate`](generate) | Turn a snapshot difference into migration files |
| [`besu migrate`](migrate) | Apply pending files, or revert with `--down` |
| [`besu push`](push) | Apply a snapshot directly, with no file |
| [`besu check`](check) | Not supported yet |
| [`besu studio`](studio) | A development-only browser for schema and rows |

Hand-written files, down migrations and the append-only rule are covered in
[custom migrations](custom). Connection strings and defaults are in
[configuration](config).

## What is checked

- `push` and `generate` agree about types: both fold them through the target dialect's
  `normalise_type`, so what one reports the other writes.
- A duplicated version, or an edited migration, stops the run before anything executes.
- A destructive change is refused by `push` unless it is explicitly allowed.
- A sequence or an enum is created before the table that uses it, a table is created after the
  tables it references, and a view is created after the tables and views it reads.
- A view is dropped before the tables it reads, and a sequence after the tables that default to
  it.
- A down file has an up file beside it, when the directory is read.

## Gotchas

- **`push` is not transactional.** Statements run one at a time, so a failure halfway leaves
  the earlier ones applied. Use `generate` and `migrate` when that matters.
- **`generate` writes destructive statements.** It does not filter by safety; the header
  warns, and the review is yours.
- **The differ only manages what the snapshot names.** A view or sequence the declaration omits
  is reported as a drop, because the default schema belongs to the application; extensions are
  invisible and are never dropped. See [views](../schema/views),
  [extensions](../schema/extensions) and [sequences](../schema/sequences).
- **A migration is append-only.** Fixing a typo in an applied file is refused. Add a new
  migration that corrects it.
