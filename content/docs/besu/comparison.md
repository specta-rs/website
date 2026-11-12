---
title: "Comparison"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/comparison.md"
---

Besu is a query builder, not an ORM. The closest comparison is Drizzle in TypeScript: both
insist that a query builder should express SQL rather than replace it. The Rust comparison is
more nuanced, because Diesel, SeaORM and sqlx occupy three different points on the same axis.

## At a glance

| | Besu | Diesel | SeaORM | sqlx | Drizzle |
| --- | --- | --- | --- | --- | --- |
| Language | Rust | Rust | Rust | Rust | TypeScript |
| Model | Typed query builder | Typed query builder + schema DSL | Entity ORM | SQL toolkit | Typed query builder |
| Async | Native | Via `diesel-async` | Native | Native | Native (JS) |
| Query style | Method chain that mirrors SQL | Method chain over a type-level DSL | `SeaQuery` builder | SQL strings | Object/method chain |
| Compile-time schema check | Struct declaration | `table!` declaration | Entity declaration | Live database (`query!`) | TypeScript types |
| Relations / eager loading | No (roadmap) | Joins only | Yes | Manual | Yes (relational queries) |
| Migrations | Schema IR diff + SQL files | `diesel_migrations` | `sea-orm-cli` | `sqlx-cli` | `drizzle-kit` |
| Backends | SQLite, PostgreSQL, MySQL | SQLite, PostgreSQL, MySQL | SQLite, PostgreSQL, MySQL | Many | PostgreSQL, MySQL, SQLite |
| Raw SQL | `sql!` with bound parameters | `sql_query` | `Statement` | Native | `sql` template |
| Maturity | Early | Mature | Mature | Mature | Mature |

## Diesel

Diesel is the established Rust query builder. Its `table!` macro declares the schema, its
type-level DSL rejects invalid queries, and it has years of edge cases solved. If you want a
mature, synchronous, strongly typed ORM-adjacent toolkit, it is still the default answer.

Where Besu differs:

- **The SQL is visible.** Diesel's DSL is expressive but the generated SQL can surprise you;
  Besu's builders are a thin layer over clauses, and `to_sql()` is exact.
- **Async is native.** Diesel is synchronous at its core; async support comes from
  `diesel-async`, which adds another layer to learn.
- **The schema lives in one struct.** Diesel's `table!` and `#[derive(Queryable)]` are two
  declarations that must agree; Besu derives both from one struct.
- **Migrations are a diff.** Diesel's migrations are up/down SQL files. Besu's `push` diffs
  the declared schema against the live one, and `generate` turns that diff into files.

Where Diesel wins: more backends (including third-party ones), a much larger ecosystem,
battle-tested support for unusual SQL, and a type system that can express more complicated
constraints. Diesel has also had far longer to sand down its error messages.

## SeaORM

SeaORM is an entity-first async ORM. You derive an entity, declare relations with `Related`,
and query through `Entity::find()`; `find_with_related` performs an eager load, and
`ActiveModel` handles partial updates.

Where Besu differs:

- **No relations.** Besu has joins, but no `Related`, no lazy loading, no `find_with_related`
  and no entity graph. You write the join and you get a tuple. This is the single biggest
  functional gap; relations and eager loading are on the [roadmap](roadmap).
- **No ActiveModel.** An update is `set(column, value)` / `set_expr(column, expr)`, not a
  partially populated model. There is no hidden "only changed fields" behaviour.
- **The SQL is the API.** SeaORM's builder is pleasant but it is still an abstraction over
  `SeaQuery`; Besu's `WHERE`, `JOIN`, `GROUP BY` and `HAVING` map one-to-one onto clauses.
- **Migrations are schema diffs.** SeaORM's migrations are Rust files with `up`/`down`
  methods; Besu's are generated SQL reviewed by a human.

Where SeaORM wins: relations, eager loading, a larger feature surface (soft deletes,
pagination helpers, nested transactions/savepoints), and a mature migration workflow with
rollbacks. If your application is an object graph, SeaORM's model is a better fit.

## sqlx

sqlx is not a query builder, so the comparison is slightly unfair. It gives you `query!`,
which connects to a database at compile time (or reads offline metadata) and checks that your
SQL, its parameter types and its result columns are real.

Where Besu differs:

- **Different guarantee.** sqlx checks your SQL against the *live schema*. Besu checks the
  Rust declaration against the *Rust type system* and never contacts a database at build
  time. sqlx catches a column that was renamed in production; Besu does not. Besu catches a
  query that mentions a table the query never joined; sqlx does not model joins at all.
- **No build-time database.** Besu builds in CI with no `DATABASE_URL`, no Docker service and
  no `.sqlx` cache. That is a real convenience, and it is also the source of the gap above.
- **A query is a value.** Besu's builders can be composed, stored in a variable and rendered
  in a unit test. `query!` is a macro over a literal, which is excellent for a fixed
  statement and awkward for a generated filter set.
- **One error type.** A build error, an encode error and a decode error all arrive as the
  driver's error. sqlx's error enum is broader because it exposes more of the protocol.

Where sqlx wins: the strongest compile-time guarantee available in Rust, direct access to
every database feature, a mature migration CLI, and no DSL to learn. Many teams will be
happier with sqlx plus a few helper functions than with any builder.

## Drizzle

Drizzle is the closest in spirit. Its schema is TypeScript, its queries look like SQL, and
`drizzle-kit` generates migrations from a schema diff. Besu borrows that insistence on
expressiveness over abstraction, and the `push` / `generate` workflow is the same idea.

Where Besu differs:

- **Rust's type system is doing the work.** Drizzle's checks are TypeScript types, which are
  erased at runtime; Besu's column, table-membership and nullability checks are trait bounds
  resolved by `rustc`.
- **No Studio.** Drizzle Studio is a database browser and query inspector; Besu has no UI
  (see the roadmap).
- **Relational queries.** Drizzle has a relational query API that returns nested objects.
  Besu returns tuples and has no relations yet.
- **Ecosystem.** Drizzle's ecosystem (adapters, Studio, community plugins) is much larger.

Where Drizzle wins: front-end integration, a mature migration tool, relational queries, and
the enormous TypeScript ecosystem. If your application is TypeScript, Besu is not an option.

## Where Besu is weaker

Being honest about the gaps is more useful than a feature matrix:

- **No relations or eager loading.** Joins are manual and return tuples.
- **No streaming.** `Driver::query` collects every row into a `Vec`. A large result set is
  fully buffered.
- **No compile-time check against the live database.** A renamed column is a runtime error.
- **Early.** The API is not stable, the crates are `0.1`, and there are fewer escape hatches
  than in a decade-old library.
- **No down migrations.** The runner is append-only; rolling back means writing another
  migration.
- **No prepared-statement cache of its own.** It delegates to the driver (sqlx), so caching
  behaviour is whatever the pool does.
- **Fewer column types.** No `u128`, no arrays, no ranges, no native `decimal` in Rust, no
  enums generated from Rust enums.
- **No query observability hooks.** There is no tracing span, no slow-query log and no
  `EXPLAIN` helper in the API.

## When to choose something else

- Choose **sqlx** if compile-time verification against the real schema is the property you
  care about most, or if you want no DSL at all.
- Choose **Diesel** if you need a mature, synchronous toolkit with the widest backend and
  ecosystem coverage.
- Choose **SeaORM** if your application is an object graph and you want relations, eager
  loading and `ActiveModel`.
- Choose **Drizzle** if you are writing TypeScript.
- Choose **Besu** if you want SQL-shaped queries, compile-time checking of the parts Rust can
  see, no build-time database, and a schema that is defined once and used for queries,
  migrations and the CLI.
