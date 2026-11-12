---
title: "Subqueries"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/subqueries.md"
---

A subquery is a `SELECT` nested inside another statement. Besu supports all four places SQL
puts one:

| Form | Written with |
| --- | --- |
| `EXISTS` / `NOT EXISTS` | [`exists`], [`not_exists`] |
| `IN (SELECT ...)` / `NOT IN (SELECT ...)` | [`in_query`], [`not_in_query`] |
| A single value in a projection or comparison | [`scalar`] |
| A table in `FROM` | [`derived`] |

[`exists`]: https://docs.rs/besu/latest/besu/fn.exists.html
[`not_exists`]: https://docs.rs/besu/latest/besu/fn.not_exists.html
[`in_query`]: https://docs.rs/besu/latest/besu/struct.Column.html#method.in_query
[`not_in_query`]: https://docs.rs/besu/latest/besu/struct.Column.html#method.not_in_query
[`scalar`]: https://docs.rs/besu/latest/besu/fn.scalar.html
[`derived`]: https://docs.rs/besu/latest/besu/fn.derived.html

```rust
// users who have written at least one post
db.select(users)
    .filter(exists(
        db.select(posts)
            .correlate(users)
            .filter(posts.author_id.eq(users.id)),
    ))
    .all()
    .await?;
```

```sql
SELECT ... FROM "users"
WHERE EXISTS (
    SELECT "posts"."id", "posts"."title", "posts"."author_id"
    FROM "posts" WHERE ("posts"."author_id" = "users"."id")
)
```

```rust
// users who have never written a post
db.select(users).filter(not_exists(/* the same subquery */))

// users whose id appears as an author
db.select(users)
    .filter(users.id.in_query(db.select(posts).pick(posts.author_id)))
```

```sql
SELECT ... FROM "users" WHERE ("users"."id" IN (SELECT "posts"."author_id" FROM "posts"))
```

## Correlating with the outer query

`db.select(posts)` fixes the subquery's row set to `(Post,)`, so referencing `users.id`
inside it does not compile. `correlate(users)` adds the outer table to the row set without
adding a `FROM` entry, which is exactly what a correlated subquery means.

The check runs in one direction. The subquery may only reference tables that are in scope,
which `correlate` provides. The reverse — requiring the *outer* query to contain the table the
subquery correlates with — is not checkable, because the outer query's row set is not in scope
where the subquery is written. Write the `correlate` call, or the SQL will reference a table
that is not there.

## Scalar subqueries

A scalar subquery produces one value, so it goes wherever an expression does: in a
projection, in a comparison, or as a function argument.

```rust
let rows: Vec<(String, i64)> = db
    .select(users)
    .pick((
        users.name,
        scalar(
            db.select(posts)
                .correlate(users)
                .filter(posts.author_id.eq(users.id))
                .pick(count_all()),
            users.id,
        ),
    ))
    .all()
    .await?;
```

```sql
SELECT "users"."name", (
    SELECT COUNT(*) FROM "posts" WHERE ("posts"."author_id" = "users"."id")
) FROM "users"
```

The second argument to `scalar` is a *witness* for the subquery's SQL type, and it is the one
piece of information `pick` cannot carry. `pick` turns a selection into the Rust type it
decodes, so a subquery that selects `count_all()` is known to be an `i64` but not to be an
`Int8` rather than a `DECIMAL(39, 0)`. Pass either the marker itself or any column of the
intended type:

```rust
scalar(query, Int8)      // COUNT(*)
scalar(query, users.id)  // the same type as users.id
```

`scalar` then checks that the subquery really decodes as the Rust type the witness implies,
the same check `in_query` makes. A projection of more than one column is rejected while the
statement is built.

A scalar subquery yields `NULL` when it returns no row, and this expression decodes into the
plain Rust type rather than `Option<_>`. An aggregate always returns a row, which is why
`count_all()` is the safe shape; for anything else, guard it with `coalesce`:

```rust
coalesce(
    scalar(
        db.select(posts)
            .correlate(users)
            .filter(posts.author_id.eq(users.id))
            .pick(posts.title),
        Text,
    ),
    "",
)
```

## Derived tables

`derived(query, "alias")` puts a finished `SELECT` in `FROM`. This is how an outer statement
aggregates, filters or joins a limited, grouped or windowed result:

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

The handle is read with `db.select(&handle)`. Passing it by reference matters: `select`
consumes its source, and the handle is also what the columns are reached through. Reach a
column that came from a plain column with `handle.column(posts.author_id)`, exactly as a
[common table expression](ctes) does. A projection that is an expression has no portable
name — PostgreSQL calls `COUNT(*)` `count` while the other two call it `count(*)` — so it is
reachable only through `column_named(name, Int8)`, with the name the dialect you target
gives it. Select it with an explicit `pick`.

The alias is quoted and written into the SQL verbatim, so it must not come from user input.
Aliases are not renamed automatically: two derived tables with the same name in one statement
are an error the database reports, because silently changing one would change what a column
reference meant.

## `IN` and nullability

`in_query` checks that the subquery selects exactly one column, and that its Rust type matches
the column's. A nullable column's `pick` produces `Option<T>`, which is rejected: use
`as_expr()` if you mean to compare against a nullable column.

`IN` follows SQL's three-valued logic: if the subquery produces a `NULL`, `x IN (...)` is
`UNKNOWN` rather than false, and a `NOT IN` over a set containing `NULL` matches **nothing**.
Prefer `EXISTS` when the subquery's column is nullable, which is also usually the faster plan.

## Parameters

The inner statement's parameters continue the outer statement's numbering, so a correlated
subquery binds as one statement:

```sql
SELECT ... FROM "users"
WHERE EXISTS (SELECT ... FROM "posts" WHERE ("posts"."author_id" = "users"."id") AND ("posts"."published" = $1))
```

A derived table's parameters come first, because its body is rendered before the outer
projection and filters. The inner statement is rendered by the same dialect and is not sealed
separately, so a PostgreSQL driver suffix is appended once, to the whole statement.

## What is checked

- The subquery's own tables must be in its row set; a correlated reference needs
  `correlate(..)`.
- `in_query` requires exactly one projected column, with a matching Rust type.
- `scalar` requires one projected column, a SQL type witness, and a matching Rust type.
- `exists` and `not_exists` accept any subquery, because their result is a `Bool` and no
  column type is involved.
- A derived table's handle must be in the statement's row set, so reading a column from one
  the statement never added does not compile. The projection itself is a value, so the
  compiler cannot see its names; the database rejects a column that is not there.

## Gotchas

- `NOT IN` over a nullable column silently matches nothing. This is SQL's rule, not Besu's,
  but it is the trap that makes people swear off `NOT IN`.
- A scalar subquery is evaluated per outer row. `EXISTS` with an index on the correlated
  column is fast; without one it is a scan per row, and the builder cannot tell you which.
- A scalar subquery that can return no row is `NULL`, which decodes as the plain Rust type
  would suggest it cannot be. Use an aggregate, or `coalesce`.
- A derived table's expression columns have dialect-specific names. Reach them with
  `column_named` and an explicit `pick` rather than relying on one database's convention.
- A set operation is not accepted as a subquery yet; convert it to one with `sql!` if you need
  it.
- A named subquery is a [common table expression](ctes): `Select::cte` names one, and
  `db.from(&cte)` reads it back. `derived` is the other shape: a name that exists only inside
  one `FROM` clause.
