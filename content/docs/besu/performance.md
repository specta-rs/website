---
title: "Performance"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/performance.md"
---

A statement is built by appending to buffers, rendered once, and handed to the driver. The
design target is one SQL string per query, one encode per parameter, one allocation per row of
*result*, and nothing per row of *work*; the numbers below are what that costs before a driver
or a network is involved.

## What a statement costs

`cargo bench -p besu` measures the builder against a dry database and a hand-written dialect,
so no server is needed. On a Ryzen-class machine, release build:

| Query | Time |
| --- | --- |
| `select` with one filter | 157 ns |
| `select` with three filters, `ORDER BY` and `LIMIT` | 318 ns |
| `select` with a projection and `COUNT(*)` | 152 ns |
| `insert` one row | 193 ns |
| `insert` one hundred rows | 10.5 µs |
| `update ... set ... where` | 246 ns |

Those numbers include `to_sql`, and therefore include a clone of the query. A query that runs
moves its values instead and pays less. The bulk insert is dominated by cloning a hundred
pre-built rows for the same reason; executing one moves them.

## Where the time goes

- **One SQL string.** `Sql` starts with a capacity estimate and every clause is written into
  that buffer. Identifiers are quoted in place with `Dialect::write_ident`, so no identifier
  gets its own `String`; placeholders are written the same way, and PostgreSQL's `$1` is built
  from digits rather than `to_string`.
- **One argument vector.** Each value is moved into `Sql::args` when it is bound. Execution
  does not clone a parameter; the driver converts each already-bound value into its own
  argument type once.
- **No allocation per condition.** A comparison stores its operands inline in the expression
  node, so `users.age.gt(18)` appends one node to the enclosing vector and allocates nothing.
  A query holds tens of nodes, not millions.
- **Buffers sized up front.** A bulk insert reserves its whole row buffer from the iterator's
  size hint, so it allocates once rather than growing through a chain of reallocations.
- **Decoding is one pass.** `all()` allocates one `Vec<R>` sized to the row count and calls
  `try_get` once per column. There is no row map, no identity map and no second statement.

## Three honest caveats

- **The table handle is not literally zero-sized.** Each `Column` stores its name as a
  `&'static str`, which is 16 bytes on a 64-bit target. A five-column handle is 80 bytes, all
  `Copy`. It is small and free to pass around, not a ZST.
- **Storing operands inline makes an expression node larger** — about 104 bytes rather than
  32 — so that a `WHERE` clause costs no allocations. The trade is a few hundred bytes of
  vector space against two allocations per condition.
- **The capacity estimate is an estimate.** It errs high, so a statement can carry a few
  hundred spare bytes of `String` capacity; it is sized to avoid copies, not to be exact.

The numbers also exclude everything below Besu: parameter encoding inside the driver, the wire
round trip, the server's parsing and planning, and result transfer. On a local database those
dominate a 157 ns build by orders of magnitude.

## Running the benchmarks

```sh
cargo bench -p besu
```

Each driver has its own bench, which needs its server:

```sh
BESU_SQLITE_BENCH_URL=/tmp/besu-bench.db cargo bench -p besu-sqlite
BESU_POSTGRES_BENCH_URL=postgres://besu:besu@localhost:55432/besu cargo bench -p besu-postgres
BESU_MYSQL_BENCH_URL=mysql://root:besu@localhost:53306/besu cargo bench -p besu-mysql
```

Without the variable the database half of the bench prints a line and registers nothing, so
`cargo bench` still works with no containers. The container commands and the review
expectations are in [Contributing](https://github.com/specta-rs/besu/blob/main/CONTRIBUTING.md#benchmarks).

## A query is built fresh, so hoist nothing

A builder borrows its executor and carries the row type, so hoisting one rarely helps: it
holds the borrow for the whole scope and it cannot change its parameters without being rebuilt
anyway. Rebuilding costs a few hundred nanoseconds, which is noise next to a round trip.

The exception is the rendered `Sql`. A cursor borrows the statement, so a stream needs it to
outlive the cursor; build the query once, render it once, and pass the `Sql` around:

```rust
let sql = db.select(users).filter(users.age.gte(18)).to_sql()?;
tracing::debug!(sql = sql.sql(), "streaming users");
let mut rows = db.stream::<User>(&sql).await?;
```

Do not keep your own cache of rendered SQL to avoid the build. A `Sql` is bound to the
arguments it was built with, so a different value needs a different statement anyway, and the
driver's prepared-statement cache already makes a repeated SQL string cheap.

## Streaming a large result set

`all()` collects every row before it returns. `stream` decodes one row at a time, so a million
rows costs a million rows of work rather than a million rows of memory.

```rust
let sql = db.select(users).order_by(users.id.asc()).to_sql()?;
let mut rows = db.stream::<User>(&sql).await?;

while let Some(user) = rows.next().await {
    let user = user?;
    process(user);
}
```

Inside a transaction the stream borrows the transaction mutably, so drop it before the next
statement or the commit:

```rust
let sql = tx.select(users).to_sql()?;
let mut rows = tx.stream::<User>(&sql).await?;
while let Some(user) = rows.next().await {
    let user = user?;
    process(user);
}
drop(rows);

tx.commit().await?;
```

## What is checked

| Claim | Checked by |
| --- | --- |
| The rendered SQL is what runs | `to_sql()` and execution both call `SelectQuery::build` |
| Parameters are encoded once | `Dialect::bind` runs when the value is bound, not per row |
| A bulk insert allocates one row buffer | `Insert::values` reserves from the size hint |
| Streaming does not collect | `Rows::next` decodes one row per poll |

## Gotchas

- **`to_sql()` clones the query.** It takes `&self` so the builder stays usable; if you do not
  need it afterwards, awaiting the builder avoids the clone.
- **`to_sql()` and execution have different error types.** `to_sql()` returns `besu::Error`;
  awaiting the query returns the driver's error. A function that does both needs a boxed error
  or a mapped one.
- **`inspect()` is for humans.** It inlines the parameters into a new `String` and must never
  be executed.
- **The bench numbers are the builder, not the database.** They tell you Besu is not the
  bottleneck; they say nothing about a query plan.
- **A stream is not free.** It has a cursor and a per-row await; for a handful of rows `all()`
  is simpler and not measurably slower.
- **`values_chunked` is not atomic.** It gets past the parameter limit by sending several
  statements, each of which commits unless it runs inside a transaction. See
  [Batch API](advanced/batch-api).
