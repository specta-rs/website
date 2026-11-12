---
title: "Connect to PostgreSQL"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/connect/postgresql.md"
---

`besu_postgres::Sqlx` wraps a sqlx `PgPool`. The pool is created with sqlx's defaults — at
most ten connections, opened lazily — and every constructor takes a libpq-style URL.

## A URL

```rust
use besu_postgres::Sqlx;

let db = besu::Database::new(
    Sqlx::connect("postgres://besu:besu@localhost:5432/besu").await?,
);
```

`Sqlx::new` is an alias for `Sqlx::connect`, so either name works. The URL carries TLS mode
and the application name in its query string, which is how sqlx expects them:

```rust
let db = besu::Database::new(
    Sqlx::connect("postgres://besu:besu@db.internal/app?sslmode=require").await?,
);
```

Reading it from the environment is the usual shape, and it keeps the password out of the
binary:

```rust
let url = std::env::var("DATABASE_URL")?;
let db = besu::Database::new(Sqlx::connect(&url).await?);
```

## Your own pool

`from_pool` is the only way to change the connection limit, the acquire timeout or the idle
timeout. This needs `sqlx` as a direct dependency:

```toml
[dependencies]
sqlx = { version = "0.8", default-features = false, features = ["postgres", "runtime-tokio"] }
```

```rust
use sqlx::postgres::PgPoolOptions;

let pool = PgPoolOptions::new()
    .max_connections(20)
    .acquire_timeout(std::time::Duration::from_secs(5))
    .connect("postgres://besu:besu@localhost:5432/besu")
    .await?;

let db = besu::Database::new(besu_postgres::Sqlx::from_pool(pool));
```

## The pool underneath

```rust
let pool = db.driver().pool();
```

`pool()` is the escape hatch: closing it at shutdown, or passing it to a library that wants a
`PgPool` directly. `db.driver()` returns the `Sqlx`, so the pool is one call away.

## Transactions

```rust
let mut tx = db.begin().await?;
tx.insert(users).value(users.insert("a@example.com", "A", 21)).await?;
tx.commit().await?;
```

`begin` borrows the database and runs every statement on one connection. `db.transaction(..)`
commits on `Ok` and rolls back on `Err`, and `tx.savepoint("name", ..)` nests inside an open
transaction. A `Transaction` is an executor, so the same builders work through `tx`.

## No connection at all

```rust
let db = besu::dry::<besu_postgres::Postgres>();

let sql = db
    .select(users)
    .filter(users.age.gte(18))
    .limit(50)
    .to_sql()?;

assert!(sql.sql().contains(r#"WHERE ("users"."age" >= $1)"#));
```

That renders the exact statement the driver would send, including the `/* besu:ii */`
parameter-shape suffix, with no server and no runtime.

## Gotchas

- Every statement with parameters carries a `/* besu:... */` comment describing the bound
  value shapes. PostgreSQL fixes parameter types at prepare time and sqlx caches statements by
  SQL text, so two calls with the same text but different parameter types would otherwise hit
  the same cache entry with the wrong types. An assertion on the whole string must include it.
- `push` is not transactional. A failed statement leaves the earlier ones applied; use
  `besu generate` and `besu migrate` for production changes.
- The default schema is implicit. Introspection reports a table in `current_schema()` without
  its schema, so `#[besu(schema = "public")]` on a table in `public` makes the declared table
  look like a different one and reports drift.
- Besu never runs `CREATE SCHEMA` or `CREATE DATABASE`; both have to exist.
- A table in another schema has `(schema, name)` as its identity, so `app.users` and `users`
  are two tables that can both exist.
- `push` manages only the schemas the declared schema mentions. A table in some other schema
  is left alone rather than reported as a drop.
- The default connection limit is ten. A service that opens several `Sqlx` values opens
  several pools, each with ten connections.
