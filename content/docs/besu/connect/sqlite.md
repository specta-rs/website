---
title: "Connect to SQLite"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/connect/sqlite.md"
---

`besu_sqlite::Sqlx` wraps a sqlx `SqlitePool` behind Besu's `Driver` trait. The constructors
differ only in what they do to the connection options, and the defaults are chosen so that a
local application does not have to think about pragmas.

## A file

```rust
use besu_sqlite::Sqlx;

let db = besu::Database::new(Sqlx::new("app.db").await?);
```

`Sqlx::new` takes any `AsRef<Path>`, creates the file if it does not exist, enables foreign
keys and switches the journal to WAL. The path is a path, not a URL: `"app.db"`, not
`"sqlite://app.db"`.

## A connection string

```rust
let db = besu::Database::new(Sqlx::connect("sqlite://app.db").await?);
```

`Sqlx::connect` parses a URL, then applies `create_if_missing(true)` and `foreign_keys(true)`
on top of whatever the URL said. It does not change the journal mode, so WAL is only on when
you asked for it in the URL or used `Sqlx::new`.

## In memory

```rust
let db = besu::Database::new(Sqlx::memory().await?);
```

`Sqlx::memory()` opens `:memory:` and is the right choice for tests. Because `:memory:` lives
for exactly one connection, the driver pins the pool to a single connection and disables the
idle timeout and maximum lifetime; a pool of several connections would give each statement its
own empty database.

## Your own pool

`from_pool` takes an already-built `SqlitePool`, which is the only way to configure timeouts
and connection limits. This needs `sqlx` as a direct dependency:

```toml
[dependencies]
sqlx = { version = "0.8", default-features = false, features = ["sqlite", "runtime-tokio"] }
```

```rust
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

let pool = SqlitePoolOptions::new()
    .max_connections(4)
    .acquire_timeout(std::time::Duration::from_secs(5))
    .connect_with(
        SqliteConnectOptions::new()
            .filename("app.db")
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal),
    )
    .await?;

let db = besu::Database::new(besu_sqlite::Sqlx::from_pool(pool));
```

Besu's own options are not merged into this pool: WAL is not enabled unless you set it here,
exactly as with `Sqlx::connect`. sqlx already enables foreign keys on every connection it
opens, so the pragma above is documentation as much as configuration.

## The pool underneath

```rust
let pool = db.driver().pool();
```

`pool()` is there for anything Besu does not cover — closing the pool at shutdown, or handing
a connection to a library that wants one. `db.driver()` is the `Sqlx`, so `pool()` is one
method call away.

## Transactions

```rust
let mut tx = db.begin().await?;
tx.insert(users).value(users.insert("a@example.com", "A", 21)).await?;
tx.commit().await?;
```

`begin` borrows the database and runs every statement on one connection; `commit` and
`rollback` consume the handle. `db.transaction(..)` wraps the same thing in a closure that
commits on `Ok` and rolls back on `Err`. Savepoints are `tx.savepoint("name", ..)`.

A schema change executes all of its statements on one connection too, because SQLite's table
rebuild toggles `PRAGMA foreign_keys`, and a pragma is per-connection.

## No connection at all

```rust
let db = besu::dry::<besu_sqlite::SQLite>();

let sql = db.select(users).filter(users.age.gte(18)).to_sql()?;
assert!(sql.sql().contains("WHERE (\"users\".\"age\" >= ?)"));
```

`besu::dry` builds a `Database<DryDriver<SQLite>>`: the typed builder and an exact `to_sql()`,
with no file, no pool and no runtime. Executing one returns an error that says to call
`to_sql` instead.

## Gotchas

- SQLite itself leaves foreign-key enforcement off. sqlx turns it on for every connection it
  opens and Besu sets the pragma explicitly, but a connection made outside the driver — the
  `sqlite3` shell, for instance — does not inherit either.
- `Sqlx::new` creates the file, so a typo in the path creates a new empty database rather than
  failing. A missing table is the first symptom.
- `Sqlx::memory()` gives each `Database` its own private database; there is no way to share one
  between connections. Two `Sqlx::memory()` calls are two unrelated databases.
- A pool over a file and a pool over `:memory:` are not interchangeable: with `:memory:` every
  connection would be empty, which is why the constructor forces one connection and ignores
  `max_connections`.
- WAL is a property of `Sqlx::new`, not of the dialect. `connect("sqlite://app.db")` leaves
  the journal mode at SQLite's default (rollback journal).
- `push` executes each statement separately, so a failure part-way leaves the earlier
  statements applied. Only migration files run inside a transaction.
