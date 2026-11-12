---
title: "Batch API"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/batch-api.md"
---

`db.batch((..))` runs several **write** statements in one transaction and returns a typed
tuple of what each one reported.

```rust
let (first, second, third) = db
    .batch((
        db.insert(users).value(users.insert("a@example.com", "Alice", 30)),
        db.insert(users).value(users.insert("b@example.com", "Bob", 31)),
        db.update(users).set(users.age, 40).filter(users.email.eq("a@example.com")),
    ))
    .await?;
```

The tuple takes one to eight `INSERT`, `UPDATE` or `DELETE` builders. Every element is
rendered before the transaction is opened, then the statements run one after another on the
transaction's connection, and the transaction commits only if all of them succeed. Each
element of the returned tuple is that statement's own driver output — usually the number of
affected rows.

## Atomicity

A batch is atomic by default, matching Drizzle. If any statement fails, the transaction is
rolled back and the error is returned; nothing the batch wrote stays, including the rows the
earlier statements inserted or changed. If every statement succeeds, the transaction commits
once.

That is the difference between a batch and awaiting the statements individually:

```rust
// If the second insert fails, the first one stays.
db.insert(users).value(users.insert("a@example.com", "Alice", 30)).await?;
db.insert(users).value(users.insert("b@example.com", "Bob", 31)).await?;
```

```rust
// If the second insert fails, neither row exists.
db.batch((
    db.insert(users).value(users.insert("a@example.com", "Alice", 30)),
    db.insert(users).value(users.insert("b@example.com", "Bob", 31)),
))
.await?;
```

A failed statement is reported as the driver's own error type, the same one every other
statement returns, so there is no second error type to handle.

## One `await`, not one round trip

This is the part worth being honest about. PostgreSQL has a pipeline protocol, but sqlx does
not expose it, and the SQLite and MySQL drivers do not pipeline at all. So a batch sends its
statements **sequentially** over one connection, exactly as a sequence of `await`s would.

What a batch buys is:

- one `await` instead of one per statement,
- one transaction, without a closure or a manual `BEGIN`/`COMMIT`,
- a typed tuple of outputs.

What it does not buy is fewer messages to the server. If the round-trip count is the
problem, a multi-row `INSERT` is the tool — see [Bulk inserts](#bulk-inserts-are-a-different-problem).

The statements run in the order the tuple lists them. A later statement can read a row an
earlier one wrote, which is why they cannot be reordered or run concurrently.

## Writes only, for now

A batched `SELECT` is not supported yet. A write always reports the driver's output type, so
every element of the tuple has the same shape. A select reports decoded rows, and its row
type lives in the builder's type parameters; making that survive a heterogeneous tuple is a
different design. Until then, run selects beside a batch, or inside
[`db.transaction`](transactions).

The `returning(..)` form of a write is not part of a batch either, for the same reason: it
returns rows rather than an affected-row count.

## The safe-statement rule still applies

`UPDATE` and `DELETE` need a `WHERE` clause, or an explicit `all_rows()`, before they can run.
A batch does not bypass that check, so `db.update(users)` with no filter does not compile as a
batch element.

## When to use a batch, and when not to

A batch is for writes that belong together and do not need each other's results:

- creating a user and their first settings row,
- moving a row and writing the audit entry that explains the move,
- seeding a fixed set of rows.

It is the wrong shape when one statement needs an id or a value that an earlier statement
generates — a batch is built before any of it runs, so there is nothing to read. Use
[`db.transaction`](transactions) there: the closure can use each statement's result.

## Bulk inserts are a different problem

`values` emits one multi-row `INSERT`, which is one round trip for the whole set:

```rust
db.insert(users)
    .values([
        users.insert("a@example.com", "Alice", 30),
        users.insert("b@example.com", "Bob", 20),
    ])
    .await?;
```

A very large iterator can exceed the dialect's parameter limit, so `values_chunked` splits it
into several statements of a fixed row count:

```rust
let outputs = db
    .insert(users)
    .values_chunked(rows, 1_000)
    .await?;
```

The chunks are **not** atomic; each statement commits on its own unless the whole call runs
inside a transaction. A batch does not help here either, because the split is within one
statement rather than across several. The parameter limit is enforced per statement, and
`values_chunked` is how a bulk load gets past it.

## Gotchas

- **A batch is not fewer round trips.** It is one transaction and one `await`. See above.
- **A batch is not a pipeline.** The next statement is not sent until the previous one
  resolves.
- **A transaction is not one round trip either.** It is `BEGIN`, then each statement, then
  `COMMIT`. It buys atomicity and a single connection, not fewer messages.
- **Order matters.** Statements run in tuple order, and a failing one stops the rest.
- **`RETURNING` is outside a batch.** PostgreSQL and SQLite support `returning`; MySQL does
  not, so a batch that needs generated ids is written as a transaction instead.
- **Eight is the limit.** Longer tuples are not implemented; split the work into two batches
  or use a transaction.
