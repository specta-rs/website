---
title: "Set operations"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/set-operations.md"
---

`union`, `union_all`, `intersect`, `intersect_all`, `except` and `except_all` combine two
queries that produce the same row type.

```rust
let adults = db.select(users).filter(users.age.gte(18));
let minors = db.select(users).filter(users.age.lt(18));

let everyone: Vec<User> = adults.union(minors).all().await?;
```

```sql
SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio"
FROM "users" WHERE ("users"."age" >= $1)
UNION
SELECT "users"."id", "users"."email", "users"."name", "users"."age", "users"."bio"
FROM "users" WHERE ("users"."age" < $2)
```

The result is a `SetQuery`, which chains and takes the clauses that belong to the compound:

```rust
let page: Vec<User> = adults
    .union_all(minors)
    .order_by(users.name.asc())
    .limit(20)
    .offset(40)
    .all()
    .await?;
```

`UNION` removes duplicates; `UNION ALL` does not. `INTERSECT` keeps rows in both sides,
`EXCEPT` keeps rows only in the left one, and the `ALL` forms keep multiplicity.

| Operation | Rows |
| --- | --- |
| `union` | in either side, deduplicated |
| `union_all` | in either side, duplicates kept |
| `intersect` | in both, deduplicated |
| `intersect_all` | in both, multiplicity is the smaller count |
| `except` | in the left and not the right, deduplicated |
| `except_all` | in the left and not the right, multiplicity subtracted |

## Dialect support

| Dialect | `INTERSECT ALL` | `EXCEPT ALL` |
| --- | --- | --- |
| PostgreSQL | yes | yes |
| MySQL 8.4 | yes | yes |
| SQLite | no | no |

The two `ALL` forms are capability constants, so SQLite records
`Error::unsupported` rather than emitting SQL it will reject. `INTERSECT` and `EXCEPT`
themselves are available everywhere; MySQL gained them in 8.0.31.

## A set query as a common table expression

`Cte::union_all` builds a `WITH RECURSIVE` clause out of an anchor and a recursive term, with
the statement reading the name back out; see [common table expressions](ctes).

`SetQuery` itself has no `cte` method yet. A named expression's columns are the source table's,
which a compound does not carry, so there is no handle to type against. A compound can still
be read from a common table expression, and a recursive definition is exactly that.

## Rules the builder enforces

A branch may not carry its own `ORDER BY`, `LIMIT`, `OFFSET` or row lock. On PostgreSQL and
SQLite a parenthesised branch can, but MySQL cannot, and SQLite refuses a parenthesised
operand in a compound at all — so the branches are never parenthesised, and a branch that sets
one of those clauses is an error naming the branch rather than a clause that silently
disappears.

Mixing `INTERSECT` with `UNION` or `EXCEPT` in one chain is refused, because the operators do
not associate the same way everywhere: `1 UNION 2 INTERSECT 2` is `{1, 2}` on PostgreSQL and
MySQL and `{2}` on SQLite.

`ORDER BY` on the compound is written **unqualified**. PostgreSQL rejects a qualified name
there ("missing FROM-clause entry") and MySQL calls it "cannot be used in global ORDER
clause"; SQLite tolerates it, but the three should agree.

## What is checked

- Both sides must produce the same row type. `select(users).union(select(posts))` is a
  compile error, and the message names both row types.
- A set query has no row set of its own for the type system to track, so the compounds are
  combined after both branches are fully built; the executor is the left branch's.
- `order_by`, `limit` and `offset` on a *branch* compile — `Select` has them — and fail when the
  statement is built, with an error naming the branch. They belong to the compound.

## Gotchas

- A compound `ORDER BY` can only name an output column, not an expression, on PostgreSQL and
  MySQL. The builder renders what you give it; an expression that is not an output column is
  the server's error.
- `first()` on a set query sets `LIMIT 1`, replacing any limit you set. It does not add an
  `ORDER BY`.
- `except` is not commutative. `a.except(b)` and `b.except(a)` are different rows.
- A compound that selects the same column twice can only be ordered by the underlying column
  name, because a compound's `ORDER BY` names output columns rather than tables.
