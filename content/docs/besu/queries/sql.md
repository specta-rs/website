---
title: "SQL"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/sql.md"
---

`sql!` builds a `Fragment`: SQL text plus bound parameters. It is the escape hatch for the
statements and clauses the typed builders do not model, and it still binds its values rather
than formatting them into the string.

```rust
let adults: Vec<User> = db
    .execute(sql!("SELECT * FROM users WHERE age > ? ORDER BY age", 18))
    .all()
    .await?;
```

## The macro

`sql!` takes a string literal followed by zero or more arguments:

```rust
let fragment = sql!(
    "SELECT * FROM users WHERE age > ? AND name LIKE ?",
    18,
    "%oscar%",
);
```

The string must be a literal, because the placeholder count is computed in a `const` block. The
number of `?` outside quoted text must equal the number of arguments; a mismatch is a compile
error:

```text
error[E0080]: evaluation panicked: besu::sql!: the SQL has a different number of `?`
placeholders than arguments
```

The arguments themselves may be runtime values. The macro stringifies them without evaluating
them, so `sql!(".. age > ?", minimum_age)` works.

## Placeholders are rewritten per dialect

`sql!` always spells parameters `?`, because that is the one form every dialect's source text
can share. Rendering rewrites them:

| Dialect | `?` becomes |
| --- | --- |
| SQLite | `?` |
| MySQL | `?` |
| PostgreSQL | `$1`, `$2`, … |

The scanner understands quoting: a `?` inside `'...'`, `"..."` or `` `...` `` is left alone, and
a doubled quote is an escape rather than the end of the literal.

```rust
// One bound parameter, with a literal `?` inside the pattern.
sql!("SELECT * FROM posts WHERE title LIKE ?", "%why?%")
```

A `?` in a `--` comment is **not** ignored; it is counted as a placeholder, so keep comments
free of question marks.

## A literal question mark

`??` is an escaped question mark, which binds nothing. It exists for operators such as
PostgreSQL's `jsonb ? 'key'`:

```rust
db.execute(sql!("SELECT ?::jsonb ?? 'a'", r#"{"a": 1}"#))
```

```sql
SELECT $1::jsonb ? 'a'
```

The compile-time arity check understands the escape, so `??` does not unbalance the count.

## Running a fragment

`Database::execute` wraps a fragment in a `RawQuery`, and `Transaction::execute` does the same
inside a transaction.

```rust
// Awaiting runs the statement and returns the driver's output.
db.execute(sql!("DELETE FROM sessions WHERE expires_at < ?", cutoff))
    .await?;

// `.all()` decodes every row into the type you name.
let rows: Vec<User> = db.execute(sql!("SELECT * FROM users")).all().await?;

// `.first()` returns the first row, if any.
let row: Option<User> = db.execute(sql!("SELECT * FROM users")).first().await?;

// `.to_sql()` renders it without running anything.
let sql = db.execute(sql!("SELECT 1")).to_sql()?;
assert_eq!(sql.sql(), "SELECT 1");
```

The row type is the same `Decode` machinery the typed builders use, and it reads columns by
position. A model consumes one column per field in declaration order, a tuple one per element,
and a scalar one column. `SELECT *` therefore only decodes into a model when the column order
matches; select a subset and decode into a tuple of the right shape.

## Binding values

Each argument is converted with `Into<Value>`, so the usual Rust types work: integers, floats,
`bool`, `String`, `&str`, `Vec<u8>`, `uuid::Uuid`, the `chrono` types and `serde_json::Value`.
`Option<T>` binds `NULL` for `None`, so an optional filter value needs no branching.

```rust
let bio: Option<&str> = None;
let rows: Vec<User> = db
    .execute(sql!("SELECT * FROM users WHERE bio = ?", bio))
    .all()
    .await?;
```

## When to reach for it

Anything the typed builders cannot express:

```rust
// A window function over a grouped result that has no typed spelling here.
let ranked: Vec<(String, i64)> = db
    .execute(sql!(
        r#"SELECT "name", ROW_NUMBER() OVER (ORDER BY "age" DESC) FROM "users""#
    ))
    .all()
    .await?;
```

```rust
// A CTE whose columns are not a table's, so there is no handle to type against.
// See [common table expressions](../advanced/ctes) for the builder.
let counts: Vec<(String, i64)> = db
    .execute(sql!(
        r#"WITH "counts" AS (
               SELECT "author_id", COUNT(*) AS "n" FROM "posts" GROUP BY "author_id"
           )
           SELECT "users"."name", "counts"."n"
           FROM "users" JOIN "counts" ON "counts"."author_id" = "users"."id""#
    ))
    .all()
    .await?;
```

The same applies to `EXPLAIN`, `INSERT ... SELECT`, DDL and any dialect-specific syntax.

## Embedding a typed query

A statement a builder rendered can be turned into a `Fragment` and wrapped in more SQL, which is
how `EXPLAIN` reaches a typed query:

```rust
let query = db.select(users).filter(users.age.gt(18)).to_sql()?;
db.execute(Fragment::from(query).wrap("EXPLAIN QUERY PLAN ", ""))
    .await?;
```

The inner statement keeps its placeholders and parameters; the wrapper text may not add
parameters of its own, because they are already numbered. A fragment produced this way belongs
to the dialect that rendered it, and rendering it for another dialect is an error rather than
corrupted SQL. Awaiting returns the driver's output; decode it with `.all::<T>()` once you know
the shape the database returns for the wrapped statement.

## What is checked

| Check | `sql!` | `Fragment::with_args` | `raw(..)` |
| --- | --- | --- | --- |
| Placeholder/argument count | Compile time | Render time | n/a |
| Arguments bound, not interpolated | Yes | Yes | n/a |
| Table and column names exist | No | No | No |
| Column types match | No | No | No |
| Dialect supports the syntax | No | No | No |

## Gotchas

- **The SQL text is used verbatim.** Building it with `format!` and user input reintroduces SQL
  injection; the parameters are the only thing that is escaped.
- **A `?` outside quotes is always a placeholder**, including one in a comment.
- **`SELECT *` is order-sensitive.** Decoding is positional, so a column added to the table
  shifts every field after it.
- **Awaiting a `RawQuery` decodes nothing.** It returns the driver's output; call `.all()` or
  `.first()` to get rows.
- **`sql!` cannot validate the dialect.** A statement valid on SQLite may be a syntax error on
  MySQL.
- **`Fragment::with_args` checks at render time.** Build one from a runtime string only when the
  text genuinely is not a literal, and expect the error at execution rather than at `cargo
  check`.
