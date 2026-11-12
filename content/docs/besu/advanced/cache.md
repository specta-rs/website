---
title: "Cache"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/cache.md"
---

Besu has no query cache, no result cache and no cached relation. Caching is an application
decision: only you know when a row stops being true. What the library owns is a rendered
statement, and that is a good cache key.

## What the driver already caches

sqlx prepares each statement and caches the prepared form per SQL *string*. That is why
repeating a query shape is cheaper than inventing a new one per call, and why the PostgreSQL
dialect appends a type suffix to statements whose parameter types can vary: two statements with
identical text but different bound types must not share one cache entry. The cache belongs to
the driver; Besu exposes no `prepare` handle of its own.

## Wrapping a query in your own cache

Build the query, render it, and use the text plus the arguments as the key.

```rust
use std::collections::HashMap;

#[derive(Table, Clone)]
#[besu(table = "users")]
pub struct User {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(unique)]
    pub email: String,
    pub name: String,
    pub age: i32,
}

async fn users_older_than(
    db: &besu::Database<besu_sqlite::Sqlx>,
    cache: &mut HashMap<String, Vec<User>>,
    min_age: i32,
) -> Result<Vec<User>, Box<dyn std::error::Error>> {
    let query = db.select(users).filter(users.age.gte(min_age));
    let sql = query.to_sql()?;
    let key = format!("{}|{:?}", sql.sql(), sql.args());

    if let Some(rows) = cache.get(&key) {
        return Ok(rows.clone());
    }

    let rows: Vec<User> = query.await?;
    cache.insert(key, rows.clone());
    Ok(rows)
}
```

`to_sql` borrows the query, so the same value is rendered and then run; nothing is built twice.
Swap the `HashMap` for whatever your runtime uses — a `RwLock`, an LRU, an external store — but
keep two properties: the key is derived from the statement, and the entry has a lifetime you
control.

## Why the statement is a stable key

`sql.sql()` is deterministic for the same builder, dialect and `Database::prefixed` prefix, and
`sql.args()` is in bind order. Two calls that build the same query from the same values
produce the same string and the same arguments.

```rust
let sql = db.select(users).filter(users.age.gte(18)).to_sql()?;
assert_eq!(
    sql.sql(),
    r#"SELECT "users"."id", "users"."email", "users"."name", "users"."age" FROM "users" WHERE ("users"."age" >= ?)"#
);
assert_eq!(sql.args().len(), 1);
```

The prefix is part of the text, so a prefixed database and an unprefixed one never share an
entry. The dialect is part of the text too, so do not reuse a key across backends.

## Gotchas

- **You own invalidation.** Nothing in Besu tells a cache that a row changed, and a table
  rebuild or migration changes the meaning of a key without changing the text. Version the
  cache yourself.
- **The argument's `Debug` form has no type tag.** A UUID and a string of the same characters
  both print as `'…'`, so a raw `Fragment` with one text and different argument types can
  collide where a typed builder cannot, because the column pins the type. Add a type tag to the
  key if you cache raw statements.
- **Caching a `Vec<User>` clones it on every hit.** The cache saves a round trip, not an
  allocation; return a reference or an `Arc` if that matters.
- **`to_sql()` does not run anything.** A key can be computed for a statement that then fails,
  so do not insert an entry before the query succeeds.
- **The prepared-statement cache is not a result cache.** It saves parsing and planning, not
  the query execution or the rows.
