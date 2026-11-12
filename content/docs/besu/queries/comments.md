---
title: "SQL comments"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/comments.md"
---

Every builder takes a `.comment(..)`, which appends a `/* ... */` after the statement so a
slow-query log can say which code ran it.

```rust
db.select(users)
    .filter(users.age.gte(18))
    .comment("feed page")
    .all()
    .await?;
```

```sql
SELECT "users"."id", ... FROM "users" WHERE ("users"."age" >= $1) /* feed page */
```

The comment is the last thing in the statement, after the dialect's own suffix (PostgreSQL
adds one that encodes the parameter types, for its prepared-statement cache). It is part of
the statement *text*, not a driver feature, which is what makes it appear everywhere at once:

- `Select::to_sql()` and `Select::inspect()` show it.
- A slow-query log shows it: PostgreSQL's `pg_stat_statements`, MySQL's slow log and SQLite's
  `sqlite3_stmt` text all keep the comment.
- [`besu::logged`](../drivers) reports it, because it reports `Sql::inspect()`.

Every builder has one: `Select`, `SetQuery`, `Insert`, `Update` and `Delete`, including their
`RETURNING` forms, so a label survives being added before or after `returning(..)`.

## What it costs

The comment becomes part of the prepared statement's cache key, so two calls with different
labels are two prepared statements even though they are the same query. Label a handful of
call sites with a fixed string, not a per-request value such as a user id — for that, bind a
parameter.

## Escaping

A `*/` inside the label would end the comment early and turn the rest of it into SQL, so it is
written as `* /`:

```rust
db.select(users).comment("weird */ label")
```

```sql
SELECT ... FROM "users" /* weird * / label */
```

That is the only transformation applied. The label is otherwise written verbatim, so it must
come from your source, not from user input — an unparameterised comment is still SQL.

## Putting a comment in a statement

Since the comment is ordinary SQL text, `sql!` can carry one as well. A `?` inside it is
counted as a placeholder by the macro's arity check, and a `--` comment ends at the newline,
so a trailing `--` swallows whatever follows.

```rust
db.execute(sql!(
    r#"-- nightly reconciliation
       UPDATE "users" SET "age" = "age" + 1 WHERE "id" = ?"#,
    1
))
.await?;
```

## Gotchas

- **A comment is part of the cache key.** Keep the label constant per call site.
- **A `?` in a comment is a placeholder** to `sql!`.
- **A `--` comment without a trailing newline** comments out the rest of the statement.
- **The label is not escaped beyond `*/`.** Never build one from user input.
