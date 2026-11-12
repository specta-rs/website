---
title: "Drizzle parity"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/parity.md"
---

Besu follows [Drizzle ORM](https://orm.drizzle.team/docs/overview)'s feature set as its
north star, translated into Rust. This page is the honest scoreboard: what maps cleanly, what
is partial, and what is deliberately absent.

Legend: **Yes** — supported end to end. **Partial** — the listed half is missing. **No** —
not implemented. **N/A** — no meaning in a Rust library.

## Fundamentals

| Drizzle | Besu | Notes |
| --- | --- | --- |
| Define a schema | **Yes** | `#[derive(Table)]`, see [schema declaration](schema/declaration) |
| Declare relations | **Partial** | `with(has_many(users.id, posts.author_id))` loads children in one extra statement. There is no relation *object*, no many-to-many and no nested `with` |
| Connect | **Yes** | One driver per crate, see [connect](connect/overview) |
| Queries + CRUD | **Partial** | SQL-style select/insert/update/delete are complete. The relational query builder is limited to one has-many level |
| Migrations | **Yes** | `push`, `pull`, `generate`, `migrate`, `--down` |

## Manage schema

| Drizzle | Besu | Notes |
| --- | --- | --- |
| Column types | **Partial** | Every primitive round-trips, plus exact `DECIMAL`, PostgreSQL arrays, timestamps with precision, collations and domains. `INTERVAL`, `INET`/`CIDR`, `BIT`, ranges, spatial and `pgvector` are database-native only |
| Indexes | **Partial** | Single-column indexes and uniques are declarable, and the IR carries the access method (`GIN`, `GiST`, `BRIN`, `FULLTEXT`, `SPATIAL`), which round-trips and is diffed. Composite indexes, expression indexes and operator classes are snapshot-only or not modelled |
| Constraints | **Partial** | Foreign keys, single and composite `UNIQUE`, and `CHECK` round-trip. A check cannot be declared from the derive yet |
| Sequences | **Yes** | `Schema::sequences`, created and diffed on PostgreSQL; SQLite and MySQL have none |
| Views | **Yes** | Declared as SQL bodies, created/replaced/dropped by `push` in dependency order, with materialised views on PostgreSQL |
| Table schemas | **Yes** | PostgreSQL; `#[besu(schema = "..")]` |
| Row-level security | **Partial** | `#[besu(rls)]` enables it and `pull` round-trips policies; a policy itself is migration SQL, and the differ never drops one |
| Extensions | **No** | `CREATE EXTENSION` is migration SQL, by design |
| Enum types | **Partial** | PostgreSQL enums round-trip and are diffed; MySQL's inline column enums are not modelled |
| Generated columns | **Yes** | `#[besu(generated = "..")]`, stored or virtual, rendered, introspected and excluded from writes |

## Access your data

| Drizzle | Besu | Notes |
| --- | --- | --- |
| Select | **Yes** | Filter, order, group, having, limit/offset, distinct, row locks, joins |
| Insert | **Yes** | `value`/`values`, `RETURNING`, `ON CONFLICT`, chunked and bulk |
| Update / delete | **Yes** | Type-state guard against a `WHERE`-less write |
| Operators | **Yes** | Comparison, `LIKE`/`ILIKE`, `BETWEEN`, `IN`, null-safe `IS DISTINCT FROM`, regex, arithmetic, `COALESCE`/`NULLIF`/`GREATEST`/`LEAST`, `CASE`, `CAST`, JSON paths and operators, full text, and PostgreSQL array operators including `= ANY` |
| Joins | **Yes** | Inner, left, right, full, cross; outer joins widen the projection to `Option` |
| Aliases | **Partial** | `alias(employees, "manager")` gives a typed self-join. Two aliases of *one* table need the tagged `alias_as` form, which is documented but not shipped |
| `sql` operator | **Yes** | `sql!`, with compile-time arity checking |
| SQL comments | **Yes** | `.comment("..")` on every builder, visible in `to_sql`, `inspect` and the query log |
| Query utils | **Partial** | `to_sql`, `inspect`, `stream`. No `$dynamic` or `$count` |
| Set operations | **Yes** | `union`, `union_all`, `intersect`, `intersect_all`, `except`, `except_all`, chainable, with the compound's own ordering and paging |
| Subqueries | **Yes** | `EXISTS`, `NOT EXISTS`, `IN (SELECT …)` and scalar subqueries, correlated with `correlate(..)`, plus derived tables in `FROM`. A set operation cannot be used as a subquery yet |
| CTEs | **Partial** | `Select::cte` / `with_cte`, including `WITH RECURSIVE`; a handle exists for a whole-row select over one table |
| Transactions | **Yes** | `begin`/`commit`/`rollback`, `transaction()`, savepoints |
| Batch API | **Partial** | `db.batch((..))` runs up to eight writes in one transaction with a typed tuple of outputs. Selects are not batched yet |
| Dynamic query building | **Partial** | A query is a value, so it can be stored, passed and composed; there is no `$dynamic` mutation handle |
| Prepared statements | **Partial** | The drivers cache prepared statements per SQL string. There is no explicit `prepare` handle |
| Custom types | **Yes** | `#[besu(sql_type = "..")]` plus your own `SqlType` marker |
| Codecs | **No** | A custom type implements `Decode` per driver instead |
| Cache | **No** | Not a library concern |
| Read replicas | **No** | Point a second `Database` at the replica |
| Streaming | **Yes** | `db.stream::<T>(&sql)` — a Besu addition, not in Drizzle |

## Migrations and tooling

| Drizzle Kit | Besu CLI | Notes |
| --- | --- | --- |
| `generate` | **Yes** | `besu generate` |
| `migrate` | **Yes** | `besu migrate`, with `--down` and `--to` |
| `push` | **Yes** | `besu push`, refusing destructive changes unless asked |
| `pull` | **Yes** | `besu pull` |
| `export` | **Partial** | `pull` writes the schema IR; SQL comes from `generate` |
| `check` | **No** | The differ and the journal verify checksums at run time instead |
| `up` | **No** | The journal upgrades itself when the runner opens it |
| `studio` | **Yes** | `besu studio`, development only |
| Seeding | **Yes** | `seed(&db).table(users, 1_000)` — deterministic per type, unique where the schema says unique, foreign keys resolved parent-first |
| Config file | **Partial** | Flags and environment variables; no project file |

## Not applicable

These are part of Drizzle's surface because it is a TypeScript library or a hosted service,
and have no counterpart here:

- **Validations** — `zod`, `valibot`, `typebox`, `arktype`, `effect-schema`. Rust has the
  type system, and an owned struct is the boundary.
- **Extensions** — the ESLint plugin and `drizzle-graphql`.
- **Realtime** — Drizzle Pulse.
- **Provider pages** — Neon, Supabase, PlanetScale, D1, Turso, Bun, Xata, Nile and the rest.
  Besu connects with a URL; TLS and pooling are the driver's business.
- **Other dialects** — MSSQL, SingleStore, CockroachDB, Gel.
- **`drizzle-kit` as a separate binary** — the same jobs live in `besu`'s subcommands.

## Where the gaps are tracked

Every **No** above that is a real feature rather than a deliberate boundary is on the
[roadmap](roadmap). The query-layer gaps (aliases, CTEs, derived tables) are the ones that
bite first, because they are the things a Drizzle user reaches for in the first week.
