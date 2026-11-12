---
title: "Roadmap"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/roadmap.md"
---

Besu is early. This page lists what is missing, in rough priority order, and what each item
would actually require. The order is a judgement about impact versus cost, not a promise.

| # | Item | Why it matters | Rough size |
| --- | --- | --- | --- |
| 1 | A native database backend | sqlx is three dependencies deep in the driver crates, and its row type is what makes a select allocate a copy of every column | Large |
| 2 | [Custom column types](#custom-column-types) | `INTERVAL`, `INET`, ranges and the rest are DDL-only | Medium |
| 3 | [wasm support](#wasm-support) | The builder compiles for wasm32; execution needs a browser driver | Large |

This page is the whole list. What is deliberately absent is in
[the comparison](comparison).

## A native database backend

Tracked as [#1](https://github.com/specta-rs/besu/issues/1).

Everything sqlx-specific is already behind `besu_core::Driver`, so the seam is ready; what is
missing is the work. A `rusqlite`-backed SQLite driver first (no wire protocol, but it forces
the synchronous-to-asynchronous decision: a connection thread with request channels, not
`spawn_blocking`), then `tokio-postgres`, then `mysql_async`. Two things to settle first,
because they change the API rather than the driver: pooling becomes Besu's problem, and TLS
becomes Besu's dependency. The issue carries the full plan.

## Custom column types

Tracked as [#98](https://github.com/specta-rs/besu/issues/98).

`#[besu(sql_type = "besu::Decimal<10, 2>")]` names a `SqlType` directly, so a sized `VARCHAR`,
an exact `DECIMAL` and a user-defined marker type can all be declared and all round-trip
through migrations. What is missing is one thing: **an exact decimal cannot be read back**.

`Decimal`'s Rust type is a `String`. SQLite stores it as `TEXT` and that works, but PostgreSQL
and MySQL return `NUMERIC`, and no driver decodes that into a string. Until one does,
`pick(decimal_column)` needs a cast, and a decimal is only half a column type.

What it would take:

- Either a `Rust = String` decode path for `NUMERIC` in the two drivers (the binary decoder
  already exists for `u64` and `u128`, so this is mostly formatting dscale), or a real decimal
  value type behind a feature. The second is better and is a dependency decision.
- The same question for PostgreSQL `INTERVAL`/`INET`/`CIDR`, MySQL `SET` and domain types,
  all of which currently come back as `TypeDef::Custom` by design.
- A derive attribute for a check constraint if `Table::checks` should be declarable rather
  than only introspectable.

## wasm support

The builder half is done: `besu-core` and `besu` compile for `wasm32-unknown-unknown`, so a
web front end can build a query and render the exact SQL a server will run. The `wasm` CI job
keeps it that way and `besu/tests/dry.rs` pins the SQL. See
[Compiling for wasm32](architecture#compiling-for-wasm32) for what does and does not work.

Executing a query in a browser is still open, and it is not a matter of a flag. The drivers
are built on sqlx, which is built on tokio, which reaches for sockets this target does not
have. What it would take:

- A new driver for a browser storage API (IndexedDB, OPFS) or an HTTP bridge to a server. It
  has to supply its own `Decode` impls, because decoding a row is the driver's job, and a
  `Dialect` that spells SQL the other end understands.
- A decision about blocking: browser storage is async but has no connection pool, while the
  `Driver` trait assumes a `Send` future and a `Send + Sync` driver. On a single-threaded wasm
  module those bounds are vacuous rather than wrong, but a driver holding JS handles is not
  `Send` in any useful sense.
- A story for the clock. `besu::logged` reads `Instant::now()` once a subscriber enables it,
  and that traps in a browser; migrations would need a timestamp that does not.

Ship the same query builder to the client and execute it on the server in the meantime; that
is the shape this half of the work was for.

## Smaller items

These are not large enough for their own section, but they are real. Each is a tracking issue.

- **[#97](https://github.com/specta-rs/besu/issues/97) — relations.** A relation object,
  many-to-many and nested eager loading.
- **[#98](https://github.com/specta-rs/besu/issues/98) — column types.** `INTERVAL`, `INET`,
  ranges, spatial, `pgvector`, and decoding an exact `DECIMAL`.
- **[#99](https://github.com/specta-rs/besu/issues/99) — indexes.** Composite, expression and
  operator-class indexes.
- **[#100](https://github.com/specta-rs/besu/issues/100) — check constraints.** Declaring one
  from the derive.
- **[#101](https://github.com/specta-rs/besu/issues/101) — row-level security.** Policies in
  the diff rather than in migration SQL only.
- **[#102](https://github.com/specta-rs/besu/issues/102) — MySQL enums.** Inline enum columns.
- **[#103](https://github.com/specta-rs/besu/issues/103) — aliases.** Two aliases of one table.
- **[#104](https://github.com/specta-rs/besu/issues/104) — composition.** Set operations as
  subqueries, CTE handles beyond one table, and a dynamic handle.
- **[#105](https://github.com/specta-rs/besu/issues/105) — batch.** Selects in a batch.

## Recently closed

Kept here so the history is visible rather than deleted:

- **#52, eager loading and relations.** `has_many(parent_key, child_foreign_key)` plus
  `Select::with` load a has-many relation with one batched second statement, and an empty
  parent result sends no second statement at all. The parent and child columns are the whole
  descriptor, so the schema layer is unchanged. Insert-with-relations, many-to-many and nested
  relations stay open.
- **#59, `u128` support.** `Value::UInt128` / `Value::Int128`, a `U128` / `I128` `SqlType`
  and derive mapping, and encode/decode in every driver. PostgreSQL and MySQL use exact
  39-digit decimals; SQLite stores the decimal digits as `TEXT`.
- **#60, the builder on wasm32.** `besu-core` and `besu` compile for
  `wasm32-unknown-unknown`, so SQL can be generated in a browser and executed on a server.
  Execution in the browser still needs a driver of its own; see
  [wasm support](#wasm-support).
- **#63, two-sided containment.** Both operands of a comparison, every aggregate argument and
  every helper-function argument are checked now.
- **#64, SQLite column changes.** `push` rebuilds the table instead of refusing.
- **#65, observability.** `besu::logged(driver)` wraps any driver with tracing, timing and a
  slow-query warning.
- **#69, parameter limits.** `Sql` refuses a statement that exceeds the dialect's limit.
- **#70, batch insert chunking.** `Insert::values_chunked`.
- **#74, a literal `?`.** `??` is an escaped question mark, for `jsonb ? 'key'`.
- **#75, publish metadata.** Every crate has a README, keywords and categories, and the
  publish order is written down in `CONTRIBUTING.md`.
- **#76, update from model.** `Update::set_model`.
- **#66, partial indexes, checks and views.** `Index::predicate` and `Table::checks` are
  introspected, diffed and rendered, `Schema::views` round-trips through `besu pull`, and an
  object the IR cannot express (an expression index, an exclusion constraint, a trigger) is
  skipped by introspection instead of making `push` drop it. A check cannot be declared in
  Rust yet; SQLite and MySQL do not introspect one, and SQLite does not read a partial index's
  predicate, so those stay migration-only there.
- **#71, PostgreSQL composite `UNIQUE`.** A multi-column constraint is `Table::uniques`,
  added and dropped with `ALTER TABLE`, instead of an index that `DROP INDEX` could not
  remove.
- **#72, schema-qualified tables.** A table's identity is `(schema, name)`; introspection
  reports every non-system schema and the differ pairs tables by both.
- **#73, `TimeTz` and enum types.** `TypeDef::TimeTz` for PostgreSQL's `TIMETZ`, and
  `Schema::enums` is introspected, diffed and rendered as `CREATE TYPE` / `ALTER TYPE`. A
  `DECIMAL` still cannot decode into a `String` on PostgreSQL or MySQL.
- **#52, eager loading.** `with(has_many(parent_key, child_fk))` loads children in one extra,
  visible statement.
- **#56, runtime driver switching.** `besu-any`'s `AnyDatabase`, chosen from the connection
  string; typed queries stay per-backend, which is the honest limit.
- **#61, table prefixes.** `Database::prefixed`. The prefix lives on `Sql`, because that is
  where every table name is written.
- **#53, streaming.** `Database::stream` / `Transaction::stream` decode row by row.
- **#67, savepoints.** `Transaction::transaction` and `savepoint(name, ..)`.
- **#58, JSON path operators.** `json_get` and `json_text` with a dotted path, rendered per
  dialect.
- **#54, rename detection.** `#[besu(renamed_from = "...")]` turns a drop plus an add into one
  `ALTER TABLE ... RENAME COLUMN`. Renaming a table still is not modelled.
- **#57, full-text search.** `matches(column, query)` and `Column::matches` bind the query and
  render `to_tsvector(..) @@ plainto_tsquery(..)` on PostgreSQL, `MATCH ... AGAINST` on MySQL
  and `MATCH` on SQLite. A `tsvector` column type, declaring the index or virtual table in
  `TableDef`, a language parameter, ranking and highlighting are still open.
- **#62, Studio UI.** `besu-studio` is a development-only server and single page: it serves
  the introspected schema, a paged row browser and a one-statement SQL endpoint. It binds
  loopback only unless `--allow-remote` is passed, because the query box runs arbitrary SQL
  and there is no authentication. See
  [The studio](architecture#the-studio).

## Contributing

Trait changes are the expensive part of this list: `Driver`, `Executor` and `Ddl` are public
API, and adding a method is a breaking change for every driver. Open an issue before starting
one of those. A new expression, a new `Change` variant or a CLI improvement is much easier to
land.
