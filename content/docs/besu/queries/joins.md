---
title: "Joins"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/joins.md"
---

A join takes a table handle and, except for `CROSS JOIN`, an `ON` expression built from columns
of both tables. The joined table becomes part of the query's row set, which is what lets later
filters and projections refer to it.

```rust
let feed: Vec<(User, Option<Post>)> = db
    .select(users)
    .left_join(posts, eq(users.id, posts.author_id))
    .await?;
```

```sql
SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio",
       "posts"."id", "posts"."title", "posts"."author_id"
FROM "users" LEFT JOIN "posts" ON ("users"."id" = "posts"."author_id")
```

## The five joins

| Method | SQL | Row type after |
| --- | --- | --- |
| `inner_join(posts, on)` | `INNER JOIN` | `(R, Post)` |
| `left_join(posts, on)` | `LEFT JOIN` | `(R, Option<Post>)` |
| `right_join(posts, on)` | `RIGHT JOIN` | `(Option<R>, Post)` |
| `full_join(posts, on)` | `FULL OUTER JOIN` | `(Option<R>, Option<Post>)` |
| `cross_join(posts)` | `CROSS JOIN` | `(R, Post)` |

`R` is the row type so far: `User` for a plain `db.select(users)`, and a nested tuple after
another join.

## Why the outer side is `Option`

A left join keeps every left row even when no right row matches, and a row with no match has
every right-hand column `NULL`. `Option<Post>` is the only honest type for that, and it forces
you to handle the missing case.

The widening follows the join path rather than the column, so a `NOT NULL` column from the
outer side still decodes as `Option`:

```rust
// `posts.title` is NOT NULL, but a user without posts has no title at all.
let rows: Vec<(String, Option<String>)> = db
    .select(users)
    .left_join(posts, eq(users.id, posts.author_id))
    .pick((users.name, posts.title))
    .await?;

// Picking the whole table widens the model the same way.
let rows: Vec<(User, Option<Post>)> = db
    .select(users)
    .left_join(posts, eq(users.id, posts.author_id))
    .pick((users, posts))
    .await?;
```

The mechanism is the path through the row set. A table behind an `Option` is found through
`Contains<()>` rather than `Contains<Zero>`, and `PathNullability` maps that path to `Nullable`.
`Selection` then combines the column's own nullability with the path's, so `Option<T>` never
nests: a nullable column on an outer side is still `Option<T>`, not `Option<Option<T>>`.

An `inner_join` does not put the joined table behind an `Option`, so `pick((users, posts))` there
is `(User, Post)`.

## Which dialects support which

`RIGHT JOIN` and `FULL OUTER JOIN` are capability flags, checked while the SQL is built.

| | `RIGHT JOIN` | `FULL OUTER JOIN` |
| --- | --- | --- |
| PostgreSQL | yes | yes |
| MySQL | yes | **no** |
| SQLite | yes, from 3.39 | yes |

MySQL sets `SUPPORTS_FULL_JOIN = false` and the statement fails to build with
``unsupported: `mysql` has no `FULL OUTER JOIN` ``. `SUPPORTS_RIGHT_JOIN` defaults to `true` and
SQLite leaves it there; the 3.39 floor is the database's, not the builder's.

## Join conditions

The `ON` expression is an ordinary boolean expression, so `and(..)` handles a compound condition:

```rust
db.select(users)
    .inner_join(posts, and(
        eq(users.id, posts.author_id),
        posts.title.ne(""),
    ))
    .await?;
```

```sql
SELECT ... FROM "users" INNER JOIN "posts"
ON (("users"."id" = "posts"."author_id") AND ("posts"."title" <> ?))
```

`CROSS JOIN` takes no `ON`, because it deliberately pairs every row with every row.

## Chaining joins

Each join adds one element to the row set and one to the row type, so a third table — here
`comments` with `id`, `post_id` and `text` — nests:

```rust
let rows: Vec<((User, Option<Post>), Comment)> = db
    .select(users)
    .left_join(posts, eq(users.id, posts.author_id))
    .inner_join(comments, eq(posts.id, comments.post_id))
    .await?;
```

The nesting is also the compile-time check: `comments.text.eq("hi")` compiles after the second
join and not before it.

## Filtering after an outer join

A filter runs after the join, so it sees the widened row. Filtering on the outer side's columns
is how you find the rows that did not match:

```rust
db.select(users)
    .left_join(posts, eq(users.id, posts.author_id))
    .filter(posts.title.is_null())
    .await?;
```

```sql
SELECT ... FROM "users" LEFT JOIN "posts" ON ("users"."id" = "posts"."author_id")
WHERE ("posts"."title" IS NULL)
```

Beware the classic trap: any other predicate on the outer side (`posts.title.eq("Hello")`)
discards the `NULL` rows, which turns the outer join into an inner one. Put the predicate in the
`ON` clause instead when you mean "join only matching posts".

## What is checked

| Mistake | When it fails |
| --- | --- |
| Referencing a column from a table that was not joined | Compile error |
| An `ON` expression that is not a boolean | Compile error |
| Projecting an outer row into a non-`Option` type | Compile error |
| `FULL OUTER JOIN` on MySQL | Build error |
| The same table handle joined twice | Compile error: the row set contains it twice |

## Gotchas

- **The default projection is every column of every joined table**, in join order. Use `pick`
  to narrow it.
- **A table handle cannot be joined twice.** The row set ends up containing the table on both
  sides, and the containment check cannot tell which copy a column means, so the query does
  not compile. A self-join needs an alias instead: `alias(employees, "manager")` is a distinct
  type in the row set. See [aliases](aliases).
- **`Option<Model>` means every column was `NULL`.** A joined model whose columns are all
  nullable can decode as `None` even when a row matched, because that is the only signal an
  outer join gives.
- **A right join widens everything before it, not itself.** `right_join` keeps the new table
  non-nullable and puts the accumulated `R` behind `Option`.
- **`cross_join` is a Cartesian product.** There is no condition and no warning; the row count
  multiplies.
