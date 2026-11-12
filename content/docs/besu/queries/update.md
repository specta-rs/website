---
title: "Update"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/update.md"
---

`db.update(table)` starts an `UPDATE`, and `set` adds a `SET` clause. The builder carries a
`SAFE` type parameter: until a `WHERE` clause exists, or until you say `all_rows()`, the
statement cannot be awaited.

```rust
db.update(users)
    .set(users.name, "Alicia")
    .filter(users.id.eq(1_i64))
    .await?;
```

```sql
UPDATE "users" SET "name" = ? WHERE ("users"."id" = ?)
```

## A filter is part of the type

`Database::update` returns `Update<'a, E, T, false>`. The `IntoFuture` implementation — the
thing that makes `.await` work — exists only for `SAFE = true`:

```rust
pub struct Update<'a, E: Executor, T, const SAFE: bool = false>;
```

So this does not compile:

```rust
db.update(users).set(users.name, "Alicia").await?;
```

```text
error[E0277]: `Update<'_, &Database<Sqlx>, UserTable>` is not a future
```

There are exactly two ways to flip the flag:

```rust
// A filter proves the statement is targeted.
db.update(users).set(users.name, "Alicia").filter(users.id.eq(1_i64)).await?;

// Or you write down, in the source, that every row is intended.
db.update(users).set(users.age, 22).all_rows().await?;
```

`all_rows()` is not a hidden bypass: it is a method whose name spells out the consequence.
`filter` and `all_rows` are the only methods that exist solely on the unsafe state, so a `SET`
with no `WHERE` cannot be built by accident.

`to_sql()` is available before either call. Rendering an unsafe statement is fine; only
execution needs the flag, which makes it possible to assert the SQL in a unit test.

## `set` versus `set_expr`

`set` binds a Rust value, checked against the column's Rust type including nullability:

```rust
db.update(users)
    .set(users.name, "Alicia")            // String column
    .set(users.age, 22)                   // i32 column
    .set(users.bio, Some("Rust".into()))  // Option<String> column
    .filter(users.id.eq(1_i64))
    .await?;
```

A nullable column takes an `Option<T>`, because that is the column's Rust type. A bare
`String` for `users.bio` does not compile; pass `Some(value)` or `None::<String>`.

`set_expr` sends an expression for the database to evaluate against the row it is updating,
which is what counters and timestamps need:

```rust
db.update(users)
    .set_expr(users.age, users.age.as_expr().plus(1))
    .filter(users.id.eq(1_i64))
    .await?;
```

```sql
UPDATE "users" SET "age" = ("users"."age" + ?) WHERE ("users"."id" = ?)
```

The difference matters: `set` reads the old value in Rust and writes a constant, while
`set_expr` computes the new value in the database. The expression must have the column's SQL
type; `.as_expr().cast::<..>()` is there when it does not. The two methods mix freely in one
statement, and `set_expr` may be called more than once.

## Writing a whole row

`set_model` sets every column from a model, skipping the primary key and any auto-incrementing
column:

```rust
db.update(users)
    .set_model(&changed_user)
    .filter(users.id.eq(changed_user.id))
    .await?;
```

The filter is still yours, because `set_model` has no opinion about which rows you meant — and
the type-state is what keeps that honest.

## `returning`

`returning` exists only once the statement is safe, so an unsafe update cannot sneak a result
type in:

```rust
let updated: Vec<User> = db
    .update(users)
    .set(users.age, 22)
    .filter(users.id.eq(1_i64))
    .returning(users)
    .await?;
```

It takes the same selections as [`pick`](select#projection): a column, an expression, a tuple
or the table handle.
`RETURNING` is dialect-dependent — PostgreSQL and SQLite support it, MySQL does not, and the
MySQL failure is a build error (``unsupported: `mysql` does not support `RETURNING` ``) rather
than a compile error.

## What is checked

| Mistake | When it fails |
| --- | --- |
| `.await` with no `filter` or `all_rows` | Compile error: no `IntoFuture` |
| Setting a column to the wrong type | Compile error at the argument |
| Setting a nullable column to a non-`Option` value | Compile error |
| A `set_expr` whose SQL type does not match the column | Compile error |
| Referencing a column from another table in the filter | Compile error: the row set is only `(T,)` |
| An update with no `set` | Build error |
| `RETURNING` on MySQL | Build error |

## Gotchas

- **`filter` can only be called once.** The first call returns `SAFE = true`, and the method
  exists only on the unsafe type. Combine conditions with `and(..)` / `or(..)` instead of
  chaining two filters.
- **There are no joins in an update.** The row set is `(T,)`, so there is no `UPDATE ... FROM`
  and no joined column in the filter. Use `raw` for a subquery, or restructure the statement.
- **`all_rows()` removes the compiler's objection, not the risk.** It is the only way to write
  a full-table update, and it is exactly what you should read twice in a diff.
- **`returning` cannot be rendered.** Once it is called the builder changes type and has no
  `to_sql()`, so assert the SQL before adding the clause.
- **A nullable column needs an `Option`.** `None::<String>` is usually needed to spell the type;
  a bare `None` often cannot be inferred.
- **MySQL cannot return the modified rows.** Select them before or after the write, or read
  `rows_affected()` from the driver output.
