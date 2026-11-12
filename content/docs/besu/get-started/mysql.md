---
title: "Get started with MySQL"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/get-started/mysql.md"
---

MySQL is the same shape again, with two differences that change the code rather than the
wording: there is no `RETURNING`, so a generated key is read back with a second `SELECT`, and
identifiers are quoted with backticks.

## Add the crates

```toml
[dependencies]
besu = "0.1"
besu-mysql = "0.1"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
```

`besu` enables `derive` and `migrate` by default. `besu-mysql` enables `sqlx` and
`runtime-tokio`.

The database has to exist before you connect. Besu creates tables and constraints, but no
`CREATE DATABASE`.

## Define a table

```rust
use besu::prelude::*;

#[derive(Table, Debug, Clone, PartialEq)]
#[besu(table = "users")]
pub struct User {
    /// `AUTO_INCREMENT` on MySQL.
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(unique)]
    pub email: String,
    pub name: String,
    pub age: i32,
    pub bio: Option<String>,
}
```

The derive emits the row type, a `users` handle, a `UserInsert` struct and a
`&'static TableDef`. See [schema declaration](../schema/declaration) for the rest.

## Connect

```rust
use besu_mysql::Sqlx;

let url = std::env::var("DATABASE_URL")
    .unwrap_or_else(|_| "mysql://root:besu@localhost:3306/besu".to_string());
let db = besu::Database::new(Sqlx::new(&url).await?);
```

`Sqlx::new` pins the session to `utf8mb4` and to `+00:00`, because timestamps are encoded as
UTC and a non-UTF-8 connection would mangle text. `Sqlx::connect` leaves the URL exactly as
written. See [connecting to MySQL](../connect/mysql) for the trade-off and pool
configuration.

## Create the table

`push` introspects, diffs against the struct, and applies only what is missing.

```rust
db.push([users.def()]).await?;
```

It sends one statement (reformatted here):

```sql
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `email` TEXT NOT NULL,
    `name` TEXT NOT NULL,
    `age` INT NOT NULL,
    `bio` TEXT,
    UNIQUE KEY `email` (`email`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

The `UNIQUE KEY` clause is how a `#[besu(unique)]` `String` is declared: MySQL cannot index a
`TEXT` column without a prefix length, so the key covers the first 255 characters. The key is
named after the column, which is how introspection tells it apart from a unique index you
declared yourself.

## Insert

MySQL has no `RETURNING`. An insert resolves to the driver's `MySqlQueryResult`, from which
`last_insert_id()` is available, and Besu refuses a `returning` clause with an error rather
than silently ignoring it.

```rust
db.insert(users)
    .value(users.insert("oscar@example.com", "Oscar", 21))
    .await?;

let oscar = db
    .select(users)
    .filter(users.email.eq("oscar@example.com"))
    .first()
    .await?
    .expect("just inserted");
```

```sql
INSERT INTO `users` (`email`, `name`, `age`) VALUES (?, ?, ?)
```

`users.insert(..)` takes exactly the columns the database cannot fill in: not the generated
`id`, not the nullable `bio`, and not a column with a default.

## Select

```rust
let adults: Vec<User> = db
    .select(users)
    .filter(users.age.gte(18))
    .order_by(users.name.asc())
    .limit(50)
    .await?;
```

```sql
SELECT `users`.`id`, `users`.`email`, `users`.`name`, `users`.`age`, `users`.`bio`
FROM `users`
WHERE (`users`.`age` >= ?)
ORDER BY `users`.`name` ASC
LIMIT ?
```

An `OFFSET` without a `LIMIT` is not grammatical on MySQL, so the builder inserts an unbounded
`LIMIT` when you set only an offset.

## Check the SQL without a database

```rust
let db = besu::dry::<besu_mysql::MySql>();

let sql = db
    .select(users)
    .filter(users.age.gte(18))
    .to_sql()?;

assert!(sql.sql().contains("WHERE (`users`.`age` >= ?)"));
```

`dry` gives you the typed builder and the exact SQL with no connection. Awaiting a query built
this way returns an error rather than a fake result.

## Next steps

- [Schema declaration](../schema/declaration) — every `#[besu(...)]` attribute.
- [MySQL column types](../schema/column-types/mysql) — unsigned integers and wide decimals.
- [Indexes and constraints](../schema/indexes-constraints) — prefix keys and foreign keys.
- [Connecting to MySQL](../connect/mysql) — charset, timezone and pools.
- [Get started with SQLite](sqlite) or [PostgreSQL](postgresql).

## Gotchas

- `AUTO_INCREMENT` requires the column to be a key. The derive does not enforce the pairing, so
  `auto_increment` without `primary_key` is accepted by the macro and rejected by the server.
- A `UNIQUE` on a `String` is a 255-character prefix key, not a constraint over the whole value.
  Two rows whose text agrees in the first 255 characters collide. A `UNIQUE` on a JSON column
  is rendered as nothing, because MySQL cannot index one; such a schema reports drift on every
  push.
- Every `TEXT` column is a full `TEXT`; there is no length argument in the derive. Use
  `#[besu(sql_type = "besu::VarChar<64>")]` when you want `VARCHAR(64)`.
- `push` is not transactional. Use `besu generate` plus `besu migrate` when a half-applied
  schema change would matter.
- MySQL has no `RETURNING` and no `FULL OUTER JOIN`; the builder rejects both when the SQL is
  built rather than sending something the server cannot parse. It also has no partial indexes.
- A `DateTime<Utc>` field is declared `DATETIME(6)` and introspects as `Timestamp`, which MySQL's
  normalisation does not fold back, so prefer `NaiveDateTime`; see
  [MySQL column types](../schema/column-types/mysql).
