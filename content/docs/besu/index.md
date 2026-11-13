---
title: "Besu"
description: "A typesafe, async, database-agnostic SQL query builder for Rust."
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/README.md"
---

Besu is a typesafe, async, database-agnostic SQL query builder for Rust. It is not an ORM:
every query you write maps onto exactly the SQL you would have written by hand, and the
compiler checks the parts it can see — column names, column types, nullability, which tables
are in the query, and whether a bulk write was intentional.

## Fundamentals

- [Overview](overview) — what Besu is, and what it deliberately is not
- [Get started with SQLite](get-started/sqlite)
- [Get started with PostgreSQL](get-started/postgresql)
- [Get started with MySQL](get-started/mysql)
- [Schema declaration](schema/declaration) — `#[derive(Table)]` and every attribute
- [Relations](schema/relations) — `has_many`, and loading children without an N+1
- [Connect](connect/overview) — a driver, a pool, a database
- [Queries and CRUD](queries/select) — the shape of every statement
- [Migrations](migrations/overview) — the schema IR, `push`, `generate`, `migrate`

## Manage schema

- Column types: [PostgreSQL](schema/column-types/postgresql) · [MySQL](schema/column-types/mysql) · [SQLite](schema/column-types/sqlite)
- [Indexes and constraints](schema/indexes-constraints)
- [Views](schema/views)
- [Sequences](schema/sequences) — PostgreSQL
- [Table schemas](schema/schemas) — PostgreSQL
- [Extensions](schema/extensions) — PostgreSQL
- [Custom types](advanced/custom-types)

## Access your data

- [Select](queries/select) · [Insert](queries/insert) · [Update](queries/update) · [Delete](queries/delete)
- [Filter and conditional operators](queries/operators)
- [Joins](queries/joins)
- [Aliases](queries/aliases)
- [The `sql!` operator](queries/sql)
- [Query utilities](queries/query-utils)
- [SQL comments](queries/comments)
- [Set operations](advanced/set-operations)
- [Subqueries](advanced/subqueries)

## Migrations

- [Migrations overview](migrations/overview)
- [`besu generate`](migrations/generate) · [`besu migrate`](migrations/migrate) · [`besu push`](migrations/push) · [`besu pull`](migrations/pull)
- [`besu studio`](migrations/studio)
- [Custom migrations](migrations/custom)
- [Configuration](migrations/config)

## Advanced

- [Transactions](advanced/transactions)
- [Generated columns](advanced/generated-columns)
- [Batch API](advanced/batch-api)
- [Dynamic query building](advanced/dynamic-query-building)
- [CTEs](advanced/ctes)
- [Seeding](advanced/seeding)
- [Cache](advanced/cache)
- [Read replicas](advanced/read-replicas)

## Reference

- [Performance](performance) — what a query costs, with numbers
- [Architecture](architecture) — the crate graph and how a query becomes SQL
- [Writing a driver](drivers) — `Dialect`, `Driver`, `SchemaDriver`, `Ddl`, `Decode`
- [Comparison](comparison) — Besu against Diesel, SeaORM, sqlx and Drizzle
