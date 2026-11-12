---
title: "Query utilities"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/query-utils.md"
---

Every statement builder can render its SQL without running it, every select can inline its
parameters for logging, and every statement can be streamed instead of collected. This page is
the toolbox around the builders themselves.

## `to_sql`

`to_sql` returns the finished statement: text plus bound parameters, ready to hand to a driver.

```rust
let sql = db
    .select(users)
    .filter(users.age.gt(18))
    .to_sql()?;

println!("{}", sql.sql());
// SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio"
// FROM "users" WHERE ("users"."age" > ?)
assert_eq!(sql.args(), [besu::Value::Int(18)]);
```

It exists on `Select`, `Insert`, `Update`, `Delete` and `RawQuery`. It does **not** exist once
`returning` is called: that changes the builder's type, and the `RETURNING` clause cannot be
rendered.

`to_sql` never fails on a query the builder rejected. Building records the error inside the
`Sql` instead of returning it, so check `sql.error()` when you render something that might not
be runnable:

```rust
let sql = db.update(users).to_sql()?;
assert!(sql.error().is_some()); // `update` requires at least one `set`
```

## `inspect`

`Select::inspect` renders the statement with its parameters inlined, which is what you want in a
log line or an error message:

```rust
let line = db
    .select(users)
    .filter(users.age.gt(18))
    .inspect()?;

assert_eq!(
    line,
    r#"SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio" FROM "users" WHERE ("users"."age" > 18)"#
);
```

The other builders have no `inspect`, so go through `Sql::inspect` on the rendered statement:

```rust
let sql = db.insert(users).value(users.insert("a@example.com", "A", 30)).to_sql()?;
println!("{}", sql.inspect());
// INSERT INTO "users" ("email", "name", "age") VALUES ('a@example.com', 'A', 30)
```

This is a debugging aid, not something to execute: the inlined text is a best-effort rendering of
each value, not a re-parseable literal.

## `stream` and `Rows`

`db.stream::<T>(&sql)` runs a statement and decodes one row at a time as the driver delivers it,
so a large scan costs one row of memory rather than the whole result set.

```rust
let sql = db
    .select(users)
    .filter(users.age.gt(18))
    .order_by(users.id.asc())
    .to_sql()?;

let mut rows = db.stream::<User>(&sql).await?;
while let Some(user) = rows.next().await {
    let user = user?;
    println!("{}", user.name);
}
```

The statement is passed in rather than built inside `stream`, because the cursor borrows the SQL
text for as long as it is open and a value cannot borrow its own temporary.

`Rows::next` returns `Option<Result<T, _>>`. A decode failure arrives as `Some(Err(..))` and the
stream stays usable, so one bad row does not force you to abandon the rest. `Rows::collect`
gathers the remainder into a `Vec`, which is convenient for small result sets and throws away the
memory advantage. `Rows` also implements `Stream`, so the usual adapters work.

`Transaction::stream` is the same method inside a transaction; the cursor holds the transaction
borrow until it is dropped.

## Asserting SQL without a database

`besu::dry::<D>()` builds a database with no driver attached. The whole typed API works, `to_sql`
is exact, and attempting to execute returns an `Unsupported` error instead of panicking. That is
how the SQL is pinned in a unit test:

```rust
use besu::prelude::*;

#[derive(Table)]
#[besu(table = "users")]
struct User {
    #[besu(primary_key, auto_increment)]
    id: i64,
    #[besu(unique)]
    email: String,
    name: String,
    age: i32,
    bio: Option<String>,
}

#[test]
fn the_filter_is_parameterised() {
    let db = besu::dry::<besu_sqlite::SQLite>();

    let sql = db
        .select(users)
        .filter(users.age.gt(18))
        .to_sql()
        .unwrap();

    assert_eq!(
        sql.sql(),
        r#"SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio" FROM "users" WHERE ("users"."age" > ?)"#
    );
    assert_eq!(sql.args(), [besu::Value::Int(18)]);
    assert!(sql.error().is_none());
}
```

The dialect is a type, so the same test can be repeated for each backend. On PostgreSQL
the statement carries a trailing `/* besu:… */` comment — the parameter-type signature that
keeps the prepared-statement cache key distinct per bound shape. It is part of the rendered
text and of the text the driver sends, because `build` seals the statement once, so compare
against a rendering from that dialect rather than a hand-written string.

## What Drizzle has that Besu does not

- **`$count`** — no shortcut for wrapping a query in `SELECT COUNT(*)`. Use `pick(count_all())`
  with the same filters, or write it with `sql!`.
- **`$with`** — the relational `with` exists as `Select::with(has_many(..))` for one has-many
  level only; there is no general `$with` for arbitrary queries.
- **`$dynamic`** — a query is a value and can be stored, passed and composed, but there is no
  mutable dynamic handle with a changed result type.
- **A subquery as a table** is [`derived`](select#derived-table), with typed columns
  reached through the handle. There is no shorthand that infers an alias.

See [#104](https://github.com/specta-rs/besu/issues/104) for the composition gaps behind them.

## Gotchas

- **`to_sql()` does not run anything.** Read `sql.error()` when the builder may have rejected
  the query.
- **`args()` is dialect-specific.** Every shipped driver uses `Value`, but the signature is
  `&[D::Value]`, so an assertion is written against the dialect's type.
- **`inspect()` inlines values, `to_sql()` does not.** Never log the parameters and the
  placeholders as if they were the same statement.
- **A stream keeps the connection busy.** The stream borrows the transaction mutably, so the
  `Rows` must be dropped before the next statement on it.
- **`returning` has no `to_sql`.** Assert the statement before adding the clause.
