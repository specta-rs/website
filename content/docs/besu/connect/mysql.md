---
title: "Connect to MySQL"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/connect/mysql.md"
---

`besu_mysql::Sqlx` wraps a sqlx `MySqlPool`. The only interesting decision is whether to let
the driver pin the session to UTF-8 and UTC, which is what `new` does and `connect` does not.

## A connection string

```rust
use besu_mysql::Sqlx;

let db = besu::Database::new(
    Sqlx::connect("mysql://root:besu@localhost:3306/app").await?,
);
```

`Sqlx::connect` parses the URL and changes nothing else, so a charset or timezone parameter in
the URL is the one that applies.

## The recommended constructor

```rust
let db = besu::Database::new(
    Sqlx::new("mysql://root:besu@localhost:3306/app").await?,
);
```

`Sqlx::new` parses the same URL and then sets `charset=utf8mb4` and `timezone=+00:00`. The
first matters because `utf8mb4` is the only character set that stores every Unicode character,
including emoji; the second because Besu encodes `chrono` timestamps as UTC, and a session in
another timezone would silently shift a `TIMESTAMP` column on the way in or out.

## Your own pool

`from_pool` is the way to change the connection limit or the timeouts. This needs `sqlx` as a
direct dependency:

```toml
[dependencies]
sqlx = { version = "0.8", default-features = false, features = ["mysql", "runtime-tokio"] }
```

```rust
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions};

let pool = MySqlPoolOptions::new()
    .max_connections(20)
    .acquire_timeout(std::time::Duration::from_secs(5))
    .connect_with(
        "mysql://root:besu@localhost:3306/app"
            .parse::<MySqlConnectOptions>()?
            .charset("utf8mb4")
            .timezone("+00:00".to_owned()),
    )
    .await?;

let db = besu::Database::new(besu_mysql::Sqlx::from_pool(pool));
```

`Sqlx::new` does exactly this, minus the connection limit and the timeout.

### Two options worth knowing

`test_before_acquire` defaults to `true`, which sends a `COM_PING` round trip on every
acquire. That is by far the largest per-call cost in this driver: switching it off measured
18% off a 1,000-row select and 15% off a single insert. It is left on because a connection
dropped while idle then surfaces as a transparent reconnect instead of a failed query — but if
you would rather have the 18%, `from_pool` is the way:

```rust
let pool = MySqlPoolOptions::new()
    .test_before_acquire(false)
    .connect(url)
    .await?;
```

`statement_cache_capacity` is sqlx's default of 100 prepared statements per connection. Besu
builds a distinct SQL string per query shape, so an application with many shapes will evict;
raise it on the pool if that shows up in `SHOW GLOBAL STATUS LIKE 'Prepared_stmt%'`.

## The pool underneath

```rust
let pool = db.driver().pool();
```

`pool()` returns the `MySqlPool` for anything Besu does not expose, such as closing it at
shutdown. `db.driver()` is the `Sqlx`.

## Transactions

```rust
let mut tx = db.begin().await?;
tx.insert(users).value(users.insert("a@example.com", "A", 21)).await?;
tx.commit().await?;
```

`begin` borrows the database and keeps every statement on one connection; `commit` and
`rollback` consume the handle. `db.transaction(..)` commits on `Ok` and rolls back on `Err`,
and `tx.savepoint("name", ..)` nests.

## No connection at all

```rust
let db = besu::dry::<besu_mysql::MySql>();

let sql = db.select(users).filter(users.age.gte(18)).to_sql()?;
assert!(sql.sql().contains("WHERE (`users`.`age` >= ?)"));
```

`besu::dry` gives the full builder and an exact `to_sql()` with no server. Executing one
returns an error that points at `to_sql`.

## Gotchas

- MySQL has no `RETURNING`. `Insert::returning` compiles and then fails when the SQL is built,
  with "`mysql` does not support `RETURNING`". Read the row back by a unique column, or use
  `MySqlQueryResult::last_insert_id()` from the insert's output.
- A statement that is not pinned to `utf8mb4` can mangle text and reject an emoji. Use
  `Sqlx::new`, or set the charset on a pool you build yourself.
- A session timezone is not the same thing as a timezone-aware column. MySQL's
  `DATETIME(6)` stores no offset; Besu sends and reads UTC and relies on the pinned session.
- DDL causes an implicit commit on MySQL, so wrapping a schema change in `db.transaction(..)`
  does not make it atomic. That is the server's rule, not the driver's.
- `OFFSET` without `LIMIT` is not grammatical; the builder supplies an unbounded `LIMIT` when
  you set only an offset. `FULL OUTER JOIN` has no MySQL spelling, and the builder rejects it
  rather than emitting something that will not parse; `NULLS FIRST`/`NULLS LAST` are emulated by
  ordering on `expr IS NULL` first.
- MySQL identifiers are quoted with backticks and a backtick inside one is doubled, so a table
  or column with an unusual name round-trips through DDL.
- `push` is not transactional, and a failed statement leaves the earlier ones applied.
