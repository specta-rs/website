---
title: "Sequences"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/sequences.md"
---

PostgreSQL is the only supported database with standalone sequences. Besu models one as a
[`Sequence`] and diffs it like any other object; SQLite and MySQL have none and render nothing for
one. The sequence behind a `SERIAL` or `IDENTITY` column is a different thing, modelled by the
column's `auto_increment` flag.

## Declaring a sequence

```rust
use besu::schema::Sequence;

let mut schema = Schema::from_defs(&[orders.def()]);
let mut numbers = Sequence::new("order_number_seq");
numbers.start = 1000;
schema.add_sequence(numbers);
```

```sql
CREATE SEQUENCE "order_number_seq" AS bigint INCREMENT BY 1 START WITH 1000 CACHE 1 NO CYCLE
```

`Sequence::new` fills in PostgreSQL's defaults: `bigint`, start 1, increment 1, cache 1, no cycle,
and no explicit bounds. The fields are:

| Field | Meaning | Default |
| --- | --- | --- |
| `name` | The sequence name, unqualified | required |
| `schema` | The schema it lives in | the default schema |
| `data_type` | `bigint`, `integer` or `smallint` | `bigint` |
| `start` | The value a fresh sequence starts at | `1` |
| `increment` | How far each `nextval` moves | `1` |
| `min` / `max` | The bounds it stops or wraps at | the type's default |
| `cycle` | Whether reaching the bound wraps | `false` |
| `cache` | Values reserved per connection | `1` |

`min` and `max` are `Option<i64>`. `None` means "the default for this data type", which is what
PostgreSQL reports back after creating the sequence, so a declaration that leaves them out
converges against a database that has a concrete bound.

## What `push` does

| Situation | Change | SQL |
| --- | --- | --- |
| Exists only in the declared schema | `CreateSequence`, `Safe` | `CREATE SEQUENCE` |
| Same name, different options | `AlterSequence`, `Risky` | `ALTER SEQUENCE` |
| Exists only in the database | `DropSequence`, `Destructive` | `DROP SEQUENCE` |

A sequence is created before the tables that might default to it, and dropped after them. The
alter statement describes the whole desired sequence, including `NO MINVALUE`, `NO MAXVALUE` and
`NO CYCLE` when a bound has been removed: there is no partial form that converges otherwise.

```sql
ALTER SEQUENCE "order_number_seq" AS bigint
    INCREMENT BY 2 NO MINVALUE NO MAXVALUE START WITH 2000 CACHE 1 CYCLE
```

## What introspection recognises

`pg_sequences` lists every sequence outside the system schemas. A sequence that a `SERIAL` or an
identity column owns is **skipped**: it belongs to its column, and `push` would otherwise try to
create or drop a sequence the column needs. The distinction is `pg_depend`: an auto dependency
(`a`) is a `SERIAL`, an internal one (`i`) is an identity column.

A `SERIAL` or identity column itself is still reported, as `auto_increment`:

- `information_schema.columns.is_identity` is `YES`, which is a modern identity column;
- `column_default` starts with `nextval(`, which is what a `SERIAL` column looks like.

Both clear the column's default, because the sequence owns the value.

## Calling `nextval` and `setval`

There is no typed builder for a sequence function; a `sequence.next()` expression would be a later
addition. Both are reachable through `sql!`:

```rust
// Take the next value and return it.
let next: Option<i64> = db
    .execute(sql!("SELECT nextval('order_number_seq')"))
    .first()
    .await?;

// Move the sequence forward, for example after a data import.
db.execute(sql!("SELECT setval('order_number_seq', 1000, true)"))
    .await?;
```

`nextval` and `setval` return `bigint`, so `i64` is the row type. The sequence name is a string
literal inside the SQL, not a bound parameter, because PostgreSQL resolves it as a `regclass`.

## Gotchas

- **`push` never emits `SERIAL`.** A pulled `SERIAL` column is re-created as an identity column on
  a fresh database. That is a different catalog representation with the same behaviour, but it is
  not the DDL you wrote originally.
- **A hand-written `DEFAULT nextval(...)` is reinterpreted.** Introspection sees the default,
  marks the column `auto_increment`, and drops the default from the snapshot. `push` and
  `generate` therefore cannot reproduce that spelling; keep it in a migration.
- **`OWNED BY` is not modelled.** A sequence tied to a column with `OWNED BY` is skipped by
  introspection (it is the column's sequence), and `push` never writes `OWNED BY` itself.
- **`nextval` is not transactional.** A value consumed inside a transaction that rolls back is
  gone, so gaps are normal and should not be read as missing rows.
- **SQLite and MySQL render no sequence statements.** A snapshot shared with PostgreSQL still
  pushes to them: the sequence changes are simply skipped. Neither database introspects one, so
  a snapshot declaring one will report the difference on every push.
- **Altering a sequence is `Risky`.** Narrowing a bound or changing the type can make `nextval`
  fail for values that are already handed out.

[`Sequence`]: https://docs.rs/besu-schema/latest/besu_schema/struct.Sequence.html
