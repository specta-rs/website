---
title: "Delete"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/delete.md"
---

`db.delete(table)` starts a `DELETE`, and `filter` adds the `WHERE` clause. The builder carries
the same `SAFE` type parameter as [`update`](update): without a filter, or an explicit
`all_rows()`, the statement does not compile.

```rust
db.delete(users)
    .filter(users.age.lt(18))
    .await?;
```

```sql
DELETE FROM "users" WHERE ("users"."age" < ?)
```

## A filter is part of the type

`Database::delete` returns `Delete<'a, E, T, false>`, and `IntoFuture` is implemented only for
`SAFE = true`:

```rust
pub struct Delete<'a, E: Executor, T, const SAFE: bool = false>;
```

So this does not compile:

```rust
db.delete(users).await?;
```

```text
error[E0277]: `Delete<'_, &Database<Sqlx>, UserTable>` is not a future
```

The two ways to make it runnable:

```rust
// A filter proves the statement is targeted.
db.delete(users).filter(users.id.eq(1_i64)).await?;

// Or you say, in the source, that every row is intended.
db.delete(users).all_rows().await?;
```

`to_sql()` is available on the unsafe builder, so the SQL of a `DELETE` can be rendered and
asserted before the filter is added.

## `returning`

`returning` returns the deleted rows, and like `update` it exists only on the safe type:

```rust
let deleted: Vec<i64> = db
    .delete(users)
    .filter(users.age.lt(18))
    .returning(users.id)
    .await?;
```

```sql
DELETE FROM "users" WHERE ("users"."age" < ?) RETURNING "users"."id"
```

It takes a column, an expression, a tuple or the table handle. PostgreSQL and SQLite support
`RETURNING`; MySQL does not, and the statement fails while building with
``unsupported: `mysql` does not support `RETURNING` ``.

## `limit`

`limit` bounds how many rows a `DELETE` removes. The limit is bound as a parameter:

```rust
db.delete(users)
    .filter(users.age.lt(18))
    .limit(100)
    .await?;
```

```sql
DELETE FROM "users" WHERE ("users"."age" < ?) LIMIT ?
```

`DELETE ... LIMIT` is not portable. PostgreSQL has no such statement, so its dialect sets
`SUPPORTS_DELETE_LIMIT = false` and the build fails:

```text
unsupported: `postgres` has no `DELETE ... LIMIT`; filter down to the rows instead
```

SQLite and MySQL leave the default of `true`. On PostgreSQL the filter has to select the rows
on its own.

A limit is **not** a safety proof. `db.delete(users).limit(1).await` still does not compile,
because a limit bounds the damage without expressing intent.

## Deleting more than you intended

The type-state proves that *some* filter exists, not that it selects the rows you meant. A
filter that matches everything is still a filter:

```rust
// Compiles, deletes every row, because every row is over 18.
db.delete(users).filter(users.age.gt(18)).await?;

// Compiles, deletes every row, because every id is positive.
db.delete(users).filter(users.id.gt(0)).await?;
```

Read the filter as a claim about the schema, not only about the type. During a migration or a
backfill, run the same predicate as a `select` first, inside the same transaction, and check the
count before the `delete` runs. `all_rows()` is the honest spelling for "all of them"; a filter
that happens to match all of them is the version that reaches production.

## What is checked

| Mistake | When it fails |
| --- | --- |
| `.await` with no `filter` or `all_rows` | Compile error: no `IntoFuture` |
| A filter that references another table | Compile error: the row set is only `(T,)` |
| `RETURNING` on MySQL | Build error |
| `limit` on PostgreSQL | Build error |

## Gotchas

- **`filter` can only be called once.** The first call returns `SAFE = true` and the method
  exists only on the unsafe type; combine conditions with `and(..)` / `or(..)`.
- **A limit does not make a delete safe.** Add a filter or `all_rows`, then the limit.
- **There are no joins in a delete.** No `DELETE ... USING`, and no joined table in the filter.
  Filter on a subquery written with `raw`, or restructure the statement.
- **`returning` cannot be rendered.** The builder changes type, so there is no `to_sql()` for a
  `DELETE ... RETURNING`.
- **MySQL cannot return the deleted rows.** Select them first, or read `rows_affected()` from
  the driver output.
- **`all_rows()` inside a transaction is still committed** when the transaction commits. It has
  no undo of its own.
