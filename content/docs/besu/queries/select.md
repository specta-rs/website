---
title: "Select"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/select.md"
---

`db.select(table)` starts a query. Every method is a value-returning step, so a query can be
built, stored, returned from a function and composed before anything runs.

```rust
let adults: Vec<User> = db
    .select(users)
    .filter(users.age.gte(18))
    .order_by(users.name.asc())
    .limit(50)
    .all()
    .await?;
```

```sql
SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio"
FROM "users" WHERE ("users"."age" >= $1) ORDER BY "users"."name" ASC LIMIT $2
```

```rust
db.select(posts).first().await?                      // Option<Post>
db.select(posts).to_sql()?                           // the exact SQL, without running it
db.select(posts).inspect()?                          // the SQL with parameters inlined, for a log
```

## Filter

`filter` adds a condition. Repeated calls are joined with `AND`.

```rust
db.select(users)
    .filter(users.age.gte(18))
    .filter(users.bio.is_not_null())
```

```sql
SELECT ... FROM "users" WHERE ("users"."age" >= $1) AND ("users"."bio" IS NOT NULL)
```

`or` and `and` compose conditions explicitly when `AND` between calls is not what you mean:

```rust
db.select(users).filter(users.age.lt(18).or(users.age.gt(65)))
```

The whole operator list is in [operators](operators).

## Order

```rust
db.select(users).order_by(users.name.asc())
db.select(users).order_by_desc(users.created_at)
db.select(users).order_by(users.name.asc().nulls_last())
```

MySQL has no `NULLS FIRST` / `NULLS LAST`; the dialect emulates the common cases with an
`IS NULL` prefix, which is a different query plan and is documented as such.

## Limit and offset

```rust
db.select(posts).order_by(posts.id.asc()).limit(20).offset(40)
```

MySQL requires a `LIMIT` before an `OFFSET`, so the dialect supplies an unbounded one when
only `offset` is set.

## Distinct

```rust
db.select(users).pick(users.country).distinct()
```

```sql
SELECT DISTINCT "users"."country" FROM "users"
```

## Projection

`select(table)` returns every column of every table in the query, decoded into `T::Model`.
`pick` chooses exactly what comes back, and the row type follows from the selection:

```rust
let names: Vec<String> = db.select(users).pick(users.name).all().await?;
let pairs: Vec<(i64, String)> = db.select(users).pick((users.id, users.name)).all().await?;
```

## Derived table

A `SELECT` can read another `SELECT` as if it were a table, which is how an outer statement
filters or aggregates a limited or grouped result:

```rust
let recent = derived(
    db.select(posts)
        .filter(posts.title.eq("Hello"))
        .pick(posts.author_id),
    "recent",
);
let author = recent.column(posts.author_id);

let counts: Vec<(i64, i64)> = db
    .select(&recent)
    .pick((author.clone(), count_all()))
    .group_by(author)
    .all()
    .await?;
```

```sql
SELECT "recent"."author_id", COUNT(*) FROM (
    SELECT "posts"."author_id" FROM "posts" WHERE ("posts"."title" = $1)
) AS "recent" GROUP BY "recent"."author_id"
```

`select` consumes its source, so pass the handle by reference when its columns are also
needed. [Subqueries](../advanced/subqueries) covers column access, expression columns and
the alias rules.

## Aggregate

```rust
let count: Vec<i64> = db.select(users).pick(count_all()).all().await?;
let by_country: Vec<(String, i64)> = db
    .select(users)
    .pick((users.country, count_all()))
    .group_by(users.country)
    .having(count_all().gt(10))
    .all()
    .await?;
```

```sql
SELECT "users"."country", COUNT(*) FROM "users"
GROUP BY "users"."country" HAVING (COUNT(*) > $1)
```

`sum` and `avg` return `Float8`; `count_all` and `count_distinct` return `Int8`.

## Join

See [joins](joins) for the five join kinds, the nullability rules for outer joins, and the
row types they produce.

```rust
let rows: Vec<(User, Option<Post>)> = db
    .select(users)
    .left_join(posts, posts.author_id.eq(users.id))
    .all()
    .await?;
```

## Load a relation

`with` runs one extra statement instead of a join, so a parent with no children gets
`Vec::new()` rather than an absent row:

```rust
let feed: Vec<(User, Vec<Post>)> = db
    .select(users)
    .with(has_many(users.id, posts.author_id))
    .all()
    .await?;
```

See [relations](../schema/relations).

## Row locking

```rust
db.select(jobs).filter(jobs.state.eq("queued")).for_update().skip_locked()
db.select(jobs).for_share().no_wait()
```

```sql
SELECT ... FROM "jobs" WHERE ("jobs"."state" = $1) FOR UPDATE SKIP LOCKED
```

SQLite has no row locking; the dialect records an error rather than emitting the clause.

## Set operations and subqueries

- [Set operations](../advanced/set-operations) — `union`, `union_all`, `intersect`, `except`
- [Subqueries](../advanced/subqueries) — `EXISTS`, `IN (SELECT ...)`, scalar subqueries and
  derived tables

## Streaming

`all` collects the result set. `stream` decodes one row at a time, which is what you want when
the set is too large to hold:

```rust
let sql = db.select(events).to_sql()?;
let mut rows = db.stream::<Event>(&sql).await?;
while let Some(event) = rows.next().await {
    handle(event?);
}
```

The statement is rendered first because a cursor borrows the SQL text for as long as it is
open.

## What is checked

- The table and column must exist on the table in the query; a join adds its table to the
  allowed set, and referencing a table you did not join does not compile.
- A filter must be a `Bool` expression, and comparisons require matching SQL types: comparing
  a text column with an integer is a compile error.
- `pick` fixes the row type; `all` and `first` decode into exactly that.
- An outer join widens the joined side of the row type to `Option`, so `user.post` cannot be
  used as if it were always present.

## Gotchas

- `order_by` on a nullable column is stable per dialect, not per SQL standard. Write
  `nulls_first`/`nulls_last` if it matters, and check the dialect caveat above.
- `limit` and `offset` bind parameters, so `LIMIT` on PostgreSQL is `$n`, not a literal.
- `first` sets `LIMIT 1`; it does not add an `ORDER BY`. Without one, which row you get is the
  database's choice.
- A `GROUP BY` query that projects a column which is neither grouped nor aggregated is
  accepted by SQLite and rejected by PostgreSQL and MySQL. The type system cannot see this.
