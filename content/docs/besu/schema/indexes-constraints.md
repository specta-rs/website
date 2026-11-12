---
title: "Indexes and constraints"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/indexes-constraints.md"
---

Primary keys, uniqueness, indexes, foreign keys and checks are schema objects: `push` diffs them
and the same DDL renders them. The derive can declare some; the rest need a snapshot or a migration.

## Primary keys

One field marked `primary_key` is an inline `PRIMARY KEY`; two or more are a table-level
constraint in declaration order.

```rust
#[besu(primary_key)]
pub user_id: i64,
#[besu(primary_key)]
pub team_id: i64,
```

```sql
CREATE TABLE "memberships" (
    "user_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    PRIMARY KEY ("user_id", "team_id")
)
```

A primary key column is implicitly `NOT NULL`. `TableDef::primary_key()` iterates the key columns
and `has_composite_primary_key()` answers the question the DDL generator asks.

## Unique constraints

A single-column `UNIQUE` is a flag on the column, rendered inline as `"email" TEXT NOT NULL UNIQUE`.

```rust
#[besu(unique)]
pub email: String,
```

Anything wider is a `Unique` — a name and a column list — because a constraint over
several columns has no per-column spelling, and the derive has no attribute for one:

```rust
use besu::schema::Unique;

schema.table_mut("memberships").unwrap().uniques.push(Unique {
    name: "memberships_user_team_key".into(),
    columns: vec!["user_id".into(), "team_id".into()],
});
```

```sql
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_team_key" UNIQUE ("user_id", "team_id")
```

On PostgreSQL that constraint owns a backing index, so `DROP INDEX` cannot remove it; the drop is
`ALTER TABLE ... DROP CONSTRAINT`. SQLite has no `ALTER TABLE ... ADD CONSTRAINT`, so a composite
unique is written inside `CREATE TABLE` and adding or dropping one afterwards renders nothing.
MySQL has no object separate from the unique key, and introspects a multi-column unique as a
`Unique` keyed by that index.

## Indexes

`#[besu(index)]` declares a single-column, non-unique index named `{table}_{column}_idx`.

```rust
#[besu(index)]
pub created_at: chrono::DateTime<chrono::Utc>,
```

```sql
CREATE INDEX "users_created_at_idx" ON "users" ("created_at")
```

A composite index has no attribute, but the IR expresses one, so a hand-built `Schema` can declare
it — `Schema::from_defs` gives you the tables and `table_mut` lets you push onto the list:

```rust
use besu::schema::{Index, IndexKind, Schema};

let mut schema = Schema::from_defs(&[users.def()]);
schema.table_mut("users").unwrap().indexes.push(Index {
    name: "users_name_email_idx".into(),
    columns: vec!["name".into(), "email".into()],
    unique: false,
    kind: IndexKind::Btree,
    predicate: None,
});

db.push_schema(&schema).await?;
```

```sql
CREATE INDEX "users_name_email_idx" ON "users" ("name", "email")
```

A `TableDef` is also a plain public struct, so a hand-written const can carry a composite index or
a multi-column foreign key. It cannot carry a unique, a predicate or a check: those live only in
the `Schema` IR. An access method is part of `Index`, so a hand-written `TableDef` can declare one.

### Access methods

`Index::kind` is the access method, and it is part of the index's identity: changing it is a
drop and a create, because both statements use the same name. The drop is a destructive change, so
`push` reports it and refuses unless `push_destructive` is used. The default is `Btree`, which is
what `#[besu(index)]` declares, and it is left out of a JSON snapshot so a snapshot written before
access methods existed loads unchanged.

```rust
use besu::schema::IndexKind;

schema.table_mut("events").unwrap().indexes.push(Index {
    name: "events_payload_idx".into(),
    columns: vec!["payload".into()],
    unique: false,
    kind: IndexKind::Gin,
    predicate: None,
});
```

| `IndexKind` | PostgreSQL | MySQL | SQLite |
| --- | --- | --- | --- |
| `Btree` | `btree` | `BTREE` | b-tree |
| `Gin` | `USING gin` | plain key | b-tree |
| `Gist` | `USING gist` | plain key | b-tree |
| `Brin` | `USING brin` | plain key | b-tree |
| `FullText` | `USING gin` | `FULLTEXT KEY` | b-tree |
| `Spatial` | `USING gist` | `SPATIAL KEY` | b-tree |

```sql
CREATE INDEX "events_payload_idx" ON "events" USING gin ("payload")
```

PostgreSQL reads `pg_am.amname` back, so a live GIN, GiST or BRIN index is reported as itself and
a declared b-tree over it is a real change. An index using `hash` or `spgist` has no `IndexKind`,
so introspection skips it rather than reporting a b-tree that is not there. MySQL reads
`STATISTICS.INDEX_TYPE`; SQLite has one access method and always reports `Btree`.

MySQL's `FULLTEXT` takes no prefix and no `UNIQUE`, and `SPATIAL` needs a `NOT NULL` geometry
column. A `GIN`, GiST or BRIN index pushed to MySQL or SQLite is created as a plain b-tree, which
is the closest thing those databases have; a snapshot that declares one will keep reporting the
difference on each push, so declare the kind that matches the target database.

### MySQL index prefixes

InnoDB limits a key to 3072 bytes, and `utf8mb4` uses up to four bytes per character. MySQL
therefore cannot key a whole `TEXT`, `BLOB` or `VARCHAR(1000)` column, and Besu renders a prefix
instead:

```sql
CREATE TABLE `users` (
    `email` VARCHAR(1000) NOT NULL,
    UNIQUE KEY `email` (`email`(768))
) ENGINE=InnoDB
```

A `UNIQUE` over a prefix is unique only over the prefix, so two values that share their first 768
characters collide. That is MySQL's limit, not a choice Besu can avoid; keep unique strings under
768 characters, or store a hash beside them.

The prefix is part of the table, so adding an index to an existing `TEXT` column needs the column
types too. `push` looks the table up in the schemas it is diffing, which is why
`CREATE INDEX users_email_idx ON users (email(255))` works rather than failing with MySQL error
1170 ("BLOB/TEXT column used in key specification without a key length").

### Partial indexes

Only PostgreSQL reads a predicate back into the IR. `Index::predicate` is the `WHERE` clause,
appended verbatim.

```rust
schema.table_mut("events").unwrap().indexes.push(Index {
    name: "events_errors_idx".into(),
    columns: vec!["kind".into()],
    unique: false,
    kind: IndexKind::Btree,
    predicate: Some("kind = 'error'".into()),
});
```

```sql
CREATE INDEX "events_errors_idx" ON "events" ("kind") WHERE kind = 'error'
```

SQLite exposes no predicate in its catalogue, so a partial index is skipped; MySQL has none.

## Foreign keys

`references` declares a single-column foreign key named `{table}_{column}_fkey`.

```rust
#[besu(references = "users.id", on_delete = "cascade", on_update = "restrict")]
pub author_id: i64,
```

```sql
CONSTRAINT "posts_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE RESTRICT
```

The accepted action spellings are listed in [schema declaration](declaration); an
unrecognised one silently becomes "no clause". A composite foreign key has no attribute, but the
`ForeignKey` type holds a column list, so it arrives the same way a composite index does — from
a `Schema` or a hand-written `TableDef`.

The referenced table does not have to be in the same `push` call, but it has to exist before the
constraint is created; `push` creates tables in dependency order.

## CHECK constraints

A check is a name and the boolean expression inside `CHECK (...)`. The derive has no attribute
for one, and `TableDef` has no field for one.

```rust
use besu::schema::Check;

schema.table_mut("accounts").unwrap().checks.push(Check {
    name: "accounts_balance_check".into(),
    expression: "balance >= 0".into(),
});
```

```sql
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_balance_check" CHECK (balance >= 0)
```

PostgreSQL is the only dialect that round-trips a check: it is read from `pg_constraint`, the extra
parentheses are normalised away, and adding or dropping one is a plain `ALTER TABLE`. SQLite keeps
a check inside the `CREATE TABLE` text and MySQL reports a `CHECK_CLAUSE` it will not accept back.

## What the derive can declare

| Object | Derive | Hand-written `TableDef` | `Schema` snapshot |
| --- | --- | --- | --- |
| Primary key, single or composite | Yes | Yes | Yes |
| `UNIQUE`, single column | Yes | Yes | Yes |
| `UNIQUE`, composite | No | No | Yes |
| Index, single column | Yes | Yes | Yes |
| Index, composite | No | Yes | Yes |
| Index access method | No | Yes | Yes |
| Partial index | No | No | Yes (PostgreSQL) |
| Foreign key, single column | Yes | Yes | Yes |
| Foreign key, composite | No | Yes | Yes |
| `CHECK` | No | No | Yes |

A table definition pushed from Rust therefore declares its keys, single-column uniques and indexes,
and its single-column foreign keys. Everything else needs a hand-written `TableDef`, a `besu pull`
snapshot or a migration.

## Generated columns

A column is generated when the database computes it from the others. The derive declares it, and
it is never part of an insert or a whole-row update:

```rust
#[besu(generated = "price * quantity")]
pub total: i64,
```

`stored` defaults to true. Pass `stored = false` for a virtual column, which PostgreSQL does not
implement and creates as stored:

```rust
#[besu(generated = "price + quantity", stored = false)]
pub shift: i64,
```

```sql
CREATE TABLE "line_items" (
    "id" INTEGER PRIMARY KEY,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total" INTEGER GENERATED ALWAYS AS (price * quantity) STORED,
    "shift" INTEGER GENERATED ALWAYS AS (price + quantity) VIRTUAL
)
```

The expression is raw SQL and Besu cannot check it, so it is your responsibility that all three
dialects accept it. A generated column cannot be a primary key, auto-increment, `unique` or carry
a default: at least one dialect rejects each of those.

PostgreSQL and MySQL report the expression in `information_schema.columns`; SQLite has no
catalogue view of it, so it is read from the `CREATE TABLE` text that `sqlite_master` stores.
Comparison folds identifier quotes and `::type` casts away, so `to_tsvector('english', bio)`
converges against the `to_tsvector('english'::regconfig, bio)` PostgreSQL reports.

## Safety

Adding an index, unique, foreign key or check is `Risky`: it validates existing rows. Changing an
index's access method is reported as a drop plus a create, and dropping an index, unique or check
is `Destructive`; dropping a foreign key is only `Risky`. Adding a generated column is `Safe`,
because there is no value to invent: the database computes one for every row.

## Gotchas

- SQLite cannot add or drop a composite `UNIQUE`, a foreign key or a check on an existing table.
  The change is reported and renders no statement; only a `CREATE TABLE` — or a table rebuild
  caused by a type change — writes one.
- MySQL renders an `ADD CONSTRAINT ... CHECK` but never introspects one, so a check in a snapshot
  is applied once and then reported again on the next push, where the duplicate name fails.
- SQLite does not report a constraint's own name, so uniques are matched by their columns rather
  than by name. Renaming a unique in a snapshot is not a change.
- MySQL stores a single-column `UNIQUE` as an index named after the column and introspects it back
  onto the column; a unique index you name yourself stays an index.
- An expression index, an index with `INCLUDE` columns and a PostgreSQL exclusion constraint are
  invisible to the IR: introspection skips them, so `push` never drops one. So is an index using
  `hash` or `spgist`, which has no `IndexKind`.
- A `FULLTEXT` or `SPATIAL` index pushed to PostgreSQL becomes a GIN or GiST index, and a GIN,
  GiST or BRIN index pushed to MySQL or SQLite becomes a plain b-tree. Introspection reports the
  kind that is really there, so declare the kind the target database supports.
- Index and foreign-key names are fixed by the derive; a hand-written object with the same name
  collides.
