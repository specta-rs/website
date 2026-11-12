---
title: "Get started with SQLite"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/get-started/sqlite.md"
---

One crate for the builder, one for the database, one struct, one query. SQLite needs no
server, so it is the shortest path from an empty crate to a row you can read back.

## Add the crates

```toml
[dependencies]
besu = "0.1"
besu-sqlite = "0.1"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
```

`besu` enables `derive` and `migrate` by default: `derive` gives you `#[derive(Table)]`, and
`migrate` gives you `push`, `introspect` and `migrate`. `besu-sqlite` enables `sqlx` and
`runtime-tokio` by default; turning `sqlx` off leaves the dialect and the DDL without a driver.

## Define a table

A table is a plain struct. Field names become column names, Rust types become SQL types, and
`Option<T>` becomes a nullable column.

```rust
use besu::prelude::*;

#[derive(Table, Debug, Clone, PartialEq)]
#[besu(table = "users")]
pub struct User {
    /// The database generates this, so `users.insert(..)` does not ask for it.
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(unique)]
    pub email: String,
    pub name: String,
    pub age: i32,
    /// Nullable, and therefore optional in an insert.
    pub bio: Option<String>,
}
```

The derive emits the row type, a `users` handle whose fields are typed column references, a
`UserInsert` struct, and a `&'static TableDef` that migrations diff. The full list is in
[schema declaration](../schema/declaration).

## Connect

```rust
use besu_sqlite::Sqlx;

let db = besu::Database::new(Sqlx::memory().await?);
```

`Sqlx::new("app.db")` opens or creates a file with foreign keys enforced and WAL journalling.
`Sqlx::connect("sqlite://app.db")` parses a connection string, and `Sqlx::memory()` is the
in-memory shorthand. See [connecting to SQLite](../connect/sqlite) for pool options.

## Create the table

`push` introspects the database first and applies only what is missing, so it is safe to run
on every boot.

```rust
db.push([users.def()]).await?;
```

It sends one statement (reformatted here):

```sql
CREATE TABLE "users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "bio" TEXT
)
```

That needs the `migrate` feature. If you would rather write the DDL yourself, run it through
`sql!`, which counts its placeholders against its arguments at compile time.

## Insert

```rust
let oscar = db
    .insert(users)
    .value(users.insert("oscar@example.com", "Oscar", 21))
    .returning(users)
    .await?
    .remove(0);

assert_eq!(oscar.bio, None);
```

`users.insert(..)` takes exactly the columns the database cannot fill in: not the generated
`id`, not the nullable `bio`, and not a column with a default. The statement is:

```sql
INSERT INTO "users" ("email", "name", "age") VALUES (?, ?, ?)
```

`.returning(users)` adds `RETURNING` with the whole column list, which is how `id` comes back.
Columns you leave alone are absent from the statement, so the database applies its default
rather than receiving an explicit value.

## Select

```rust
let adults: Vec<User> = db
    .select(users)
    .filter(users.age.gte(18))
    .order_by(users.name.asc())
    .limit(50)
    .await?;
```

The builder produces the SQL you would have written:

```sql
SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio"
FROM "users"
WHERE ("users"."age" >= ?)
ORDER BY "users"."name" ASC
LIMIT ?
```

Every column name, column type and table membership in that builder was checked before this
ran; the SQL is the output, not a description of it.

## Check the SQL without a database

A dialect can render a query on its own, which is how query shapes are tested:

```rust
let db = besu::dry::<besu_sqlite::SQLite>();

let sql = db
    .select(users)
    .filter(users.age.gte(18))
    .to_sql()?;

assert!(sql.sql().contains(r#"WHERE ("users"."age" >= ?)"#));
```

Awaiting a query built this way returns an error rather than panicking, so a dry database
cannot quietly pretend a write succeeded.

## Next steps

- [Schema declaration](../schema/declaration) — every `#[besu(...)]` attribute.
- [SQLite column types](../schema/column-types/sqlite) — what each Rust type round-trips to.
- [Indexes and constraints](../schema/indexes-constraints) — uniqueness, foreign keys, checks.
- [Connecting to SQLite](../connect/sqlite) — pools, files and transactions.
- [Get started with PostgreSQL](postgresql) or [MySQL](mysql).

## Gotchas

- The handle comes from the *table* name, not the struct name. `#[besu(table = "users")]`
  generates `users`; a struct called `UserProfile` with no attribute generates `user_profile`.
- A table must be a struct with named fields and no generic parameters. Enums, tuples and unit
  structs are rejected at compile time.
- Row decoding follows declaration order. A hand-written `SELECT *` has to list the columns in
  the same order as the struct, or decoding fails at runtime.
- `push` is idempotent because it diffs first; `create_schema` is not, and fails if a table
  already exists.
- The `?` in generated SQL is SQLite's placeholder spelling. A test that asserts on SQL text is
  dialect-specific even though the builder is not.
- A `Sqlx::memory()` database lives on exactly one connection because the driver pins the pool
  to `max_connections(1)`; a pool over `:memory:` would otherwise open several empty databases.
