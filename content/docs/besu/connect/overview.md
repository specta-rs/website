---
title: "Connect"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/connect/overview.md"
---

Besu splits the thing that knows SQL syntax from the thing that owns a connection. The
dialect is a type, chosen at compile time; the driver is a value holding a pool. A
`Database<Dr>` is the driver plus an optional table prefix, and every query builder borrows it.

## The two halves

```rust
use besu::prelude::*;
use besu_sqlite::Sqlx;

let db = besu::Database::new(Sqlx::new("app.db").await?);

let adults: Vec<User> = db.select(users).filter(users.age.gte(18)).await?;
```

`Sqlx` is the driver: it knows how to connect, bind a `Value` and decode a row. `SQLite` is
the dialect: it knows how to spell `?`, `AUTOINCREMENT` and `BOOLEAN`, and it can render a
query with no connection at all. `besu_sqlite::Database` is a type alias for
`besu::Database<Sqlx>` if you prefer the short name.

Nothing in the query code is dialect-specific, so the same function body works against every
backend when it is generic over the driver:

```rust
async fn adults<Dr: besu::Driver>(db: &besu::Database<Dr>) -> Result<Vec<User>, Dr::Error>
where
    User: besu::Decode<Dr>,
{
    db.select(users).filter(users.age.gte(18)).await
}
```

The dialect comes back as soon as you name a driver, which is why one binary can hold two
`Database`s without either knowing about the other.

## Which crate to depend on

| Crate | What it gives you |
| --- | --- |
| [`besu`](https://github.com/specta-rs/besu/tree/main/besu) | The builders, the expression DSL, `sql!`, and `#[derive(Table)]` |
| [`besu-sqlite`](https://github.com/specta-rs/besu/tree/main/besu-sqlite) · [`besu-postgres`](https://github.com/specta-rs/besu/tree/main/besu-postgres) · [`besu-mysql`](https://github.com/specta-rs/besu/tree/main/besu-mysql) | A dialect, a sqlx driver, DDL generation and introspection |
| [`besu-core`](https://github.com/specta-rs/besu/tree/main/besu-core) | `Dialect`, `Driver`, `Sql`, `Value`, `Decode`; no builder and no database |
| [`besu-schema`](https://github.com/specta-rs/besu/tree/main/besu-schema) | The schema IR, the differ, the DDL trait and the migrator |
| [`besu-any`](https://github.com/specta-rs/besu/tree/main/besu-any) | `AnyDatabase`: one enum over all three backends |

Depend on `besu` plus exactly one driver crate. `besu-core` is for writing a driver or a
dialect of your own; `besu-schema` arrives automatically with `besu`'s `migrate` feature, which
is on by default.

## Drivers

Each driver crate has the same entry points, with per-database differences:

| | SQLite | PostgreSQL | MySQL |
| --- | --- | --- | --- |
| File or URL | `Sqlx::new("app.db")` | `Sqlx::new(url)` | `Sqlx::new(url)` |
| Connection string | `Sqlx::connect(url)` | `Sqlx::connect(url)` | `Sqlx::connect(url)` |
| In memory | `Sqlx::memory()` | — | — |
| Existing pool | `Sqlx::from_pool(pool)` | `Sqlx::from_pool(pool)` | `Sqlx::from_pool(pool)` |

`new` is not always a synonym for `connect`. On SQLite it takes a path and turns on foreign
keys and WAL; on MySQL it pins the session to `utf8mb4` and UTC; on PostgreSQL it is an alias.
The driver pages spell out each one:

- [SQLite](sqlite)
- [PostgreSQL](postgresql)
- [MySQL](mysql)

## One database, chosen at runtime

Typed builders are compile-time over a dialect, so a query cannot be shared between two
databases whose SQL differs. What can be dynamic is connecting, applying a schema, running
migrations, and executing SQL you already have as text:

```rust
use besu_any::AnyDatabase;

let db = AnyDatabase::connect(&std::env::var("DATABASE_URL")?).await?;
let schema = besu::schema::Schema::load("schema.json")?;
db.push_schema(&schema, false).await?;
db.migrate(&besu::schema::Migrator::from_dir("migrations")?).await?;
```

For typed queries, match on the variant and call a generic helper. Each arm has its own error
type, so a real dispatcher maps them onto one application error:

```rust
match db {
    AnyDatabase::Sqlite(db) => adults(db).await,
    AnyDatabase::Postgres(db) => adults(db).await,
    AnyDatabase::MySql(db) => adults(db).await,
}
```

## Transactions

`begin` gives you a handle that runs every statement on one connection. Dropping it without
committing rolls back, and `commit`/`rollback` consume it.

```rust
let mut tx = db.begin().await?;
tx.insert(users).value(users.insert("a@example.com", "A", 1)).await?;
tx.rollback().await?;
```

`transaction` does the commit and rollback for you: the closure commits on `Ok` and rolls back
on `Err`. A savepoint is the same shape inside an open transaction.

```rust
db.transaction(async |tx| {
    tx.insert(users).value(users.insert("a@example.com", "A", 1)).await?;
    Ok(())
})
.await?;

let mut tx = db.begin().await?;
tx.savepoint("attempt", async |tx| {
    tx.insert(users).value(users.insert("b@example.com", "B", 2)).await?;
    Ok(())
})
.await?;
tx.commit().await?;
```

## Shared databases

`Database::prefixed` appends a prefix to every table name a statement mentions, including the
schema `push` diffs, so one physical database can hold several tenants' tables:

```rust
let db = besu::Database::prefixed(Sqlx::new("app.db").await?, "tenant_42_");
```

Hand-written migration SQL is not rewritten; write the prefix into it yourself.

## Gotchas

- `Database::new` does not connect. Each `Sqlx::…` constructor has already opened a pool by
  the time it returns, so a failed connection is a constructor error, not a query error.
- `Database` is not `Clone`: a builder borrows it, so a second handle comes from
  `driver().clone()`, which shares the same pool.
- The capability constants on `Dialect` (`SUPPORTS_RETURNING`, `SUPPORTS_ILIKE`,
  `SUPPORTS_FULL_JOIN`, `SUPPORTS_NULLS_ORDER`, `REQUIRES_LIMIT_WITH_OFFSET`) are what make a
  builder reject a clause the server cannot parse. They are checked when the SQL is built, not
  by the compiler.
- A transaction runs on its own connection, so a statement sent through `db` while `tx` is open
  is not part of it: it will not see uncommitted rows, and it may block on a write lock.
- Pool configuration lives in the driver crate's `from_pool` constructor; that is the only way
  to set a timeout or a connection limit.
