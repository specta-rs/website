---
title: "Views"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/views.md"
---

A view is a named `SELECT` the database stores. Besu models one as a [`View`] — a name and the
definition as SQL — because a query cannot be reconstructed from the IR in general. `push`
creates, replaces and drops views, and `besu pull` records the ones that exist.

## Declaring a view

```rust
use besu::schema::{Schema, View};

let mut schema = Schema::from_defs(&[users.def()]);
schema.add_view(View::new(
    "active_users",
    "SELECT id, email FROM users WHERE active",
));

db.push_schema(&schema).await?;
```

```sql
CREATE TABLE "users" (...);
CREATE VIEW "active_users" AS SELECT id, email FROM users WHERE active;
```

`Schema::add_view` replaces an existing view of the same name, so a declared schema can be built
from several pieces without checking first. The name follows the same rule as a table: a view in
the connection's `current_schema()` is unqualified, and one anywhere else is `schema.view`.

The definition is SQL: a `SELECT` body for PostgreSQL and MySQL, and the whole `CREATE VIEW`
statement for SQLite. Both spellings are accepted when DDL is rendered, so a snapshot pulled from
one database can be pushed to another.

## What `push` does

| Situation | Change | SQL |
| --- | --- | --- |
| Exists only in the declared schema | `CreateView`, `Safe` | `CREATE VIEW` |
| Same name, different definition | `ReplaceView`, `Risky` | `CREATE OR REPLACE VIEW` |
| Exists only in the database | `DropView`, `Destructive` | `DROP VIEW` |

A view is created *after* the tables it reads, and dropped *before* them. Every `CreateView`
sorts after every `CreateTable`, so a view over a table created in the same run works. Views that
reference other views are ordered by the names that follow `FROM` and `JOIN` in their definitions,
which is a token scan rather than a parse: a dependency it cannot see keeps the view in
alphabetical position.

A dropped view is destructive: other objects and queries can select from it. `push` refuses it
unless you call `push_destructive`.

## Comparing definitions

Two views are compared by normalising both definitions and comparing the text. A database
rewrites what it is given, so the comparison folds away:

- identifier quoting (`"users"`, `` `users` ``) and case;
- table qualifiers (`users.id` is the same column as `id`);
- whitespace and a trailing semicolon;
- the `CREATE VIEW ... AS` header SQLite records;
- `AS` aliases that only repeat their column, which MySQL adds;
- parentheses around a comparison, which PostgreSQL adds (`WHERE (id > 0)`).

It is a best effort. A definition the database rewrites in a way this cannot undo — `SELECT *`
expanded into a column list, or an expression re-associated — is reported as changed and
re-created on each push. Declare the columns explicitly and the common cases converge.

## Materialised views

PostgreSQL is the only dialect with them. Set `materialised` on the `View`:

```rust
let mut view = View::new("daily_totals", "SELECT day, sum(amount) FROM sales GROUP BY day");
view.materialised = true;
schema.add_view(view);
```

```sql
CREATE MATERIALIZED VIEW "daily_totals" AS SELECT day, sum(amount) FROM sales GROUP BY day
```

A changed materialised view is dropped, created and refreshed, because PostgreSQL has no
`CREATE OR REPLACE MATERIALIZED VIEW`:

```sql
DROP MATERIALIZED VIEW "daily_totals";
CREATE MATERIALIZED VIEW "daily_totals" AS ...;
REFRESH MATERIALIZED VIEW "daily_totals";
```

That re-runs the query, which is why the change is `Risky`. `REFRESH MATERIALIZED VIEW` is also
available as ordinary SQL when you want to refresh without a schema change:

```rust
db.execute(sql!("REFRESH MATERIALIZED VIEW daily_totals")).await?;
```

MySQL and SQLite have no materialised views. A snapshot that declares one is created there as an
ordinary view, which is documented drift: introspection reports it as non-materialised and the
next push sees the difference.

## What `besu pull` records

`besu pull` introspects the live database and writes the whole `Schema` as JSON, views included.
A view whose definition cannot be read, because the connected role cannot see it, is skipped
rather than recorded with an empty body.

```sh
besu pull --database postgres://user:pass@host/db --out schema.json
# wrote 4 table(s) from postgres to schema.json
```

The message counts tables only, so a database of views and no base tables reports `0`. The
snapshot still contains the views.

## What is checked

- A view is never reported as a table, so `Schema::find` will not return one.
- `Schema::sort` orders views by name, so two equivalent snapshots serialise identically.
- The snapshot round-trips: a view recorded by `besu pull` loads back as the same `View`.
- Pushing an introspected schema is a no-op, including the definition the database rewrote.

## Gotchas

- **A migration that drops a column a view uses will fail on PostgreSQL.** The statement is
  refused because the view depends on the column, and `push` is not transactional, so earlier
  statements have already run. `push` drops a view it is removing before the columns change, but
  a view it is keeping has to be replaced or dropped by hand first.
- **The topological order of views is inferred.** It reads names after `FROM` and `JOIN`; a view
  reached another way — a function, a lateral join written oddly — may be created before its
  dependency. Declaring them in dependency order is always safe.
- **The name is the only identity.** A view in another schema is stored as `schema.view`; there
  is no separate `schema` field to query.
- **A view over a protected table runs as its owner by default.** On PostgreSQL 15 and later, set
  `security_invoker = true` on the view; before that, filter inside the view.

[`View`]: https://docs.rs/besu-schema/latest/besu_schema/struct.View.html
