---
title: "Generated columns"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/generated-columns.md"
---

A generated column is computed by the database from an expression over other columns. It is
either `STORED` (written on each insert and update) or `VIRTUAL` (computed when read). Declare
it on the model and Besu writes it in `CREATE TABLE`, reads it back through introspection, and
never writes it.

```rust
#[derive(Table)]
#[besu(table = "users")]
pub struct User {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    /// Computed by the database; `users.insert(..)` does not take it.
    #[besu(generated = "first_name || ' ' || last_name")]
    pub full_name: String,
}
```

```sql
CREATE TABLE "users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED
)
```

The generated column is dropped from the insert struct and from `set_model`, so there is no
way to write to it by accident — the database would reject it.

## Stored and virtual

`STORED` is the default. `#[besu(generated = "..", stored = false)]` asks for `VIRTUAL`, which
SQLite and MySQL support and PostgreSQL does not; on PostgreSQL the dialect maps it to stored,
because `GENERATED ALWAYS AS ... VIRTUAL` is not a thing there.

```sql
-- MySQL
`full_name` VARCHAR(255) NOT NULL GENERATED ALWAYS AS (concat(`first_name`,' ',`last_name`)) VIRTUAL
```

## Reading one

A generated column is an ordinary column on the model, so a `select` returns it like any other.
It cannot be filtered on with an index unless you add one, and a virtual column cannot be
indexed in MySQL before 8.0.13.

## Migrations

The differ compares the expression, folding `::type` casts and identifier quoting, so
PostgreSQL's `to_tsvector('english'::regconfig, bio)` compares equal to
`to_tsvector('english', bio)`.

- On PostgreSQL and MySQL, changing the expression is a drop and re-add of the column.
- On SQLite it is a table rebuild; the rebuild copies the base columns and lets the generated
  one recompute, rather than trying to insert into it.

## What is checked

- The expression is opaque to the compiler: a typo is a database error at `push`, not a
  compile error.
- A field with `#[besu(generated = "..")]` is excluded from the insert struct, so writing it
  is a compile error.
- Introspection reads it back on all three dialects (`information_schema` on PostgreSQL and
  MySQL, `PRAGMA table_xinfo` on SQLite), so `pull` → `push` converges.

## Gotchas

- A generated column still needs its Rust type to match what the expression produces, and the
  compiler cannot check that. A `i32` field over a `TEXT` expression decodes as an error.
- SQLite's `PRAGMA table_info` hides generated columns; Besu uses `table_xinfo`. If you inspect
  the schema with another tool that uses `table_info`, the column will look missing.
- A `VIRTUAL` column cannot be added to a table that already has `STORED` columns on older
  MySQL point releases; the server says so and `push` reports it.
- A hand-written `TableDef` must set `auto_increment` alongside `generated` for `set_model` to
  skip it. The derive does that for you.
