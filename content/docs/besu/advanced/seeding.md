---
title: "Seeding"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/seeding.md"
---

`besu::seed` generates rows from a table's declaration. It is for the data a test needs but
does not care about: names, emails, timestamps and foreign keys that only have to exist and
be consistent. The rows go through the ordinary typed insert builder, in batches, inside one
transaction, so a seed is checked by the same compiler and rendered by the same statement
builder as a hand-written insert.

```rust
use besu::prelude::*;

let report = seed(&db)
    .seed(42)
    .table(users, 1_000)
    .table(posts, 5_000)
    .await?;

assert_eq!(report.rows("users"), 1_000);
assert_eq!(report.total(), 6_000);
```

`seed` borrows the database and returns a builder. Each `table` names a table and a row count,
and awaiting the builder runs the whole plan in one transaction: either every table is
seeded, or none is. `SeedReport` records how many rows went where.

## Determinism

Every value is generated from SplitMix64, seeded by the master seed, the table's name and the
row's index. The same seed and the schema produce the same rows on every run:

```rust
seed(&db).seed(7).table(users, 50).await?;
```

`seed(0)` is the default. The number is part of the data, so changing it changes every row;
keeping it fixed is what lets a failing test be replayed by number instead of by fixture.

## What each column gets

The derive implements `Seedable` and fills each column from its `SqlType`:

| Column type | Generated value |
| --- | --- |
| signed and unsigned integers | a small positive number in a type-sized range |
| `auto_increment` / integer primary key | the row number, starting at 1 |
| `f32`, `f64` | a value between 0 and 10,000 with two decimals |
| `TEXT` | a name, an email address, or a short sentence, chosen from the column's name |
| `CHAR(n)`, `VARCHAR(n)` | the same, fitted to the length |
| `DECIMAL(p, s)` | an exact decimal with exactly `s` digits after the point |
| `BYTEA` / `BLOB` | eight random bytes |
| `DATE`, `TIME` | a date in a fixed ten-year window, a time within the day |
| `TIMESTAMP`, `TIMESTAMPTZ` | a timestamp in a fixed ten-year window |
| `UUID` | a version-4-shaped UUID |
| `JSON`, `JSONB` | a small object with an id, a flag and a label |
| `BOOLEAN` | `true` or `false` |
| arrays | an empty array |
| `Option<T>` | `NULL` roughly a quarter of the time; a `NOT NULL` column never is |

The window is fixed rather than relative to the clock, so a seeded timestamp does not change
between runs. A `#[besu(generated = "..")]` column is never written; the database computes it
from the columns the seed does fill.

## Unique columns

A column marked `#[besu(unique)]`, and any primary key that is not auto-incrementing, is
generated uniquely. Text gets a row counter appended (an email keeps its shape:
`ada.lovelace17@example.com`), integers and decimals include the row number, dates and
timestamps step through their window by row, and a UUID is unique by construction.

```rust
#[derive(Table)]
#[besu(table = "users")]
pub struct User {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(unique)]
    pub email: String,
    pub name: String,
}
```

A unique `BOOLEAN`, or a unique integer narrow enough that the row count does not fit, cannot
be made unique by any generator; the insert reports the constraint violation.

## Foreign keys

Tables are seeded in the order they appear in the chain. A table records the values it wrote
for its primary-key and unique columns, and a `references` column picks from the parent's
pool:

```rust
#[derive(Table)]
#[besu(table = "posts")]
pub struct Post {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(references = "users.id", on_delete = "cascade")]
    pub author_id: i64,
    pub title: String,
}

seed(&db).table(users, 1_000).table(posts, 5_000).await?;
```

Listing the child first is an error, not a dangling key:

```text
invalid query: cannot seed a foreign key referencing `users.id`: seed `users` first
```

The same applies to a parent seeded with zero rows. **A self-referencing table is not
supported**: the key pool for a table is filled from the rows it has already inserted, and the
first row is generated before any key exists, so seeding one fails with
`cannot seed a foreign key referencing ...`. `set` pins one value for every row and cannot
carve out a single root. Seed the roots with a plain `insert` first, then the rest — or leave
the column nullable and write the parent references yourself.

The referenced column must be a primary key or a unique column, because that is what SQL
requires of a foreign key. A reference written with a schema prefix
(`references = "audit.users.id"`) is looked up by its last table segment.

## Overrides

`set` pins a column to a value for every row of the table:

```rust
seed(&db)
    .table(users, 1)
    .set(users.email, "fixed@example.com")
    .set(users.name, "Oscar")
    .set(users.bio, None::<String>)
    .await?;
```

The value is checked against the column's SQL type at compile time. `None::<String>` writes an
explicit `NULL`, while a value replaces the generated one rather than being appended to it.
Overriding a unique column to one value only makes sense when the table has one row.

## Custom column types

A custom `sql_type` has no honest default, so the derive leaves that column unset and lists it
as required when SQL would also refuse a missing value. The seed fails before inserting
anything, naming the column:

```text
invalid query: `events.payload` has no generator; give it a value with `.set(..)`
```

A nullable custom column, or one with a database default, is simply omitted and the database
fills it in.

## Batching

`values_chunked` writes several rows per statement. The default is 500 rows per statement,
which keeps a wide table under every supported database's parameter limit:

```rust
seed(&db).batch_size(1_000).table(users, 10_000).await?;
```

The whole seed is one transaction regardless of the batch size. That is deliberate: a
partially seeded parent table is worse than an empty one.

## What it does not do

- **No fixtures by example.** There is no `factory` file, no named dataset and no way to say
  "one admin and three editors". Those rows matter, so write them with the insert builder.
- **No inference from a live database.** A table's columns come from `#[derive(Table)]`, not
  from introspection. `migrate` can compare the two, but seeding does not.
- **No cycle resolution.** Parent-first ordering is the caller's job. A schema with a cycle
  needs an override at the point where it closes.
- **No parallel generation.** The rows are generated and inserted table by table.
- **No `RETURNING` round trip.** Auto-incrementing keys are written explicitly so a child can
  refer to them on MySQL as well as PostgreSQL and SQLite. That means a seed expects an empty
  table; seeding a table that already has rows collides on the key, so use `.set` there.

## Without the generator

A seed is still allowed to be ordinary code. When the rows are part of the deployed state — a
lookup table, a default role — a migration is better: it runs once, in order, inside the
migration runner's transaction, and the journal records that it happened.

```sql
-- migrations/0003_seed_roles.sql
INSERT INTO roles (name) VALUES
    ('admin'),
    ('editor'),
    ('reader')
ON CONFLICT (name) DO NOTHING;
```

The file is applied by `besu migrate`, or by `Migrator::from_dir` plus `db.migrate(..)` at
start-up. `ON CONFLICT` is PostgreSQL and SQLite spelling; MySQL needs another form of
idempotence. Writing the `.down.sql` is optional but expected: without it the migration
cannot be reverted.

## Gotchas

- **There is no environment guard.** A seeding binary pointed at production will seed
  production. Check the connection string yourself before it runs.
- **A seed migration is forever.** It runs once per database, and editing an applied file is
  refused because the journal checksums it. Fix data with a new migration.
- **The seed owns the table's columns.** A column added to the struct is generated on the next
  run, which is usually what a test wants but is a change to the data as well as the code.
