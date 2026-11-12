---
title: "MySQL column types"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/column-types/mysql.md"
---

MySQL has real unsigned integers, which makes it the only dialect where the whole `u64` range
is stored in a native integer. Everything wider than 64 bits becomes an exact decimal, and
timestamps are `DATETIME(6)` rather than `TIMESTAMP`.

## Type mapping

| Rust field | `SqlType` | `TypeDef` | SQL |
| --- | --- | --- | --- |
| `bool` | `Bool` | `Bool` | `BOOLEAN` |
| `i8` | `Int1` | `Int2` | `SMALLINT` |
| `i16` | `Int2` | `Int2` | `SMALLINT` |
| `i32` | `Int4` | `Int4` | `INT` |
| `i64` | `Int8` | `Int8` | `BIGINT` |
| `u8` | `UInt1` | `UInt(8)` | `TINYINT UNSIGNED` |
| `u16` | `UInt2` | `UInt(16)` | `SMALLINT UNSIGNED` |
| `u32` | `UInt4` | `UInt(32)` | `INT UNSIGNED` |
| `u64` | `UInt8` | `UInt(64)` | `BIGINT UNSIGNED` |
| `u128` | `U128` | `UInt(128)` | `DECIMAL(39,0)` |
| `i128` | `I128` | `Decimal(39, 0)` | `DECIMAL(39,0)` |
| `f32` | `Float4` | `Float4` | `FLOAT` |
| `f64` | `Float8` | `Float8` | `DOUBLE` |
| `String` | `Text` | `Text` | `TEXT` |
| `Vec<u8>` | `Bytes` | `Bytes` | `BLOB` |
| `uuid::Uuid` | `Uuid` | `Uuid` | `BINARY(16)` |
| `chrono::NaiveDate` | `Date` | `Date` | `DATE` |
| `chrono::NaiveTime` | `Time` | `Time` | `TIME(6)` |
| `chrono::NaiveDateTime` | `Timestamp` | `Timestamp` | `DATETIME(6)` |
| `chrono::DateTime<Utc>` | `TimestampTz` | `TimestampTz` | `DATETIME(6)` |
| `serde_json::Value` | `Json` | `Json` | `JSON` |
| `#[besu(sql_type = "..")]` | `Char<N>`, `VarChar<N>`, `Decimal<P, S>` | matching | `CHAR(n)`, `VARCHAR(n)`, `DECIMAL(p,s)` |

Everything in the table round-trips through an insert and a `SELECT`. MySQL has no array type, so
a `Vec<T>` field is not supported here; the `Custom` types below round-trip through DDL only.

## Integers

MySQL has signed and unsigned types at every width, so each marker maps onto the type of the
same name.

```rust
pub tiny: u8,    // TINYINT UNSIGNED
pub normal: u16, // SMALLINT UNSIGNED
pub big: u32,    // INT UNSIGNED
pub huge: u64,   // BIGINT UNSIGNED
```

A `u64` column holds the whole range. Decoding tries the unsigned type first and falls back to
the signed one, because a computed value such as `COUNT(*)` is reported as `BIGINT UNSIGNED`
even when the column behind it is signed. A signed column holding a negative number fails to
decode into `u64` rather than wrapping.

## Text

`String` is `TEXT`, which in MySQL is a 64 KiB text type with no length argument in the derive.
Use `sql_type` for a bounded column:

```rust
#[besu(sql_type = "besu::VarChar<64>")]
pub code: String,
```

A `TEXT` or `BLOB` column cannot be indexed without a prefix, and MySQL cannot index `JSON` at
all. That is why a `UNIQUE` on a `String` is a 255-character prefix key and a `UNIQUE` on a JSON
column renders as nothing.

## Binary

`Vec<u8>` is `BLOB` and round-trips unchanged.

```rust
pub payload: Vec<u8>,
```

## Time

`NaiveDateTime` and `DateTime<Utc>` are both `DATETIME(6)`, and `NaiveTime` is `TIME(6)`. The
fractional precision is part of the declaration so the nanoseconds a `chrono` value carries are
not truncated to whole seconds on the way in. `DATETIME` is chosen over MySQL's `TIMESTAMP`
because `TIMESTAMP` is range-limited to 2038 and converts through the session time zone on the
way in and out.

```rust
pub at: chrono::NaiveTime,                       // TIME(6)
pub seen: chrono::NaiveDateTime,                 // DATETIME(6)
pub recorded: chrono::DateTime<chrono::Utc>,     // DATETIME(6), no offset stored
```

Introspection keeps a precision other than 6: a hand-created `TIME(3)` comes back as `TimeP(3)`
and renders `TIME(3)` again. `TIME(6)` and `DATETIME(6)` fold onto the plain `Time` and
`Timestamp` the derive declares, so a second push is a no-op.

There is no timezone-aware column: the offset is dropped, and the driver relies on the session
being pinned to UTC. `Sqlx::new` does that; `Sqlx::connect` does not.

Introspection reports a `DATETIME` as `Timestamp`. Both `Timestamp` and `TimestampTz` render
`DATETIME(6)`, and type normalisation folds the two, so a `DateTime<Utc>` column converges:
`push` is a no-op the second time. The offset is still not stored — it is the session's job,
and `Sqlx::new` pins the session to UTC.

## JSON

`serde_json::Value` is `JSON`. The driver serialises the document and binds it as text; MySQL
validates it, and a malformed document is an insert error rather than a stored string.

```rust
pub document: serde_json::Value,
```

A default on a JSON column has to be parenthesised, which the DDL generator does for you, and the
column cannot be indexed or made unique.

## UUID

`uuid::Uuid` is `BINARY(16)`, not a 36-character string: smaller, and ordered as bytes rather
than as text.

```rust
pub id: uuid::Uuid,
```

Introspection maps `binary(16)` to `Uuid`; a `varbinary(16)` of the same bytes, or a `blob`, is
reported as `Bytes`, so the declared length is what identifies the type.

## Decimal

`Decimal<PRECISION, SCALE>` renders `DECIMAL(p,s)` and its Rust type is `String` holding the
exact text. A string parameter is coerced by the server into the column's type, so the digits
never pass through a float; decoding reads the `NEWDECIMAL` text back, which keeps the column's
scale (`0.00` stays `0.00`).

```rust
#[besu(sql_type = "besu::Decimal<10,2>")]
pub amount: String,
```

`IntoSqlValue<Decimal<P, S>>` is implemented for `String`, `&str` and `Cow` at every precision
and scale, so `amounts.amount.eq("1.23")` compiles. `sum_as`/`avg_as` (and the `SumAs`/`AvgAs`
methods) give an exact aggregate without the `DOUBLE` cast that `sum` and `avg` apply.

## 128-bit integers

`u128` and `i128` are both `DECIMAL(39,0)`, which holds the whole range exactly. The driver
formats the digits straight into the wire buffer, and decoding parses an unscaled decimal back
into the 128-bit integer; a value with a fractional part is truncated, not rounded.

```rust
pub huge: u128,     // DECIMAL(39,0)
pub signed: i128,   // DECIMAL(39,0)
```

Introspection cannot tell the two apart, and the differ folds `UInt(128)` onto `Decimal(39,0)`,
so a declared `u128` converges against the `DECIMAL(39,0)` reported back.

## What introspection reports

| Native type | `TypeDef` |
| --- | --- |
| `tinyint(1)` | `Bool` (`UInt(8)` when `unsigned`) |
| `tinyint`, `mediumint` | `Custom("tinyint")`, `Custom("mediumint")` |
| `smallint`, `int`, `bigint` | `Int2`, `Int4`, `Int8` |
| any integer `UNSIGNED` | `UInt(8)`, `UInt(16)`, `UInt(32)`, `UInt(32)`, `UInt(64)` |
| `float` | `Float4` |
| `double`, `real` | `Float8` |
| `char(n)` | `Char(n)` |
| `varchar(n)` | `VarChar(n)`; with no length, `Text` |
| `text` | `Text` |
| `tinytext`, `mediumtext`, `longtext` | `Custom("tinytext")` and so on |
| `binary(16)` | `Uuid` |
| `binary`, `varbinary`, `blob` | `Bytes` |
| `tinyblob`, `mediumblob`, `longblob` | `Custom("tinyblob")` and so on |
| `json` | `Json` |
| `date` | `Date` |
| `time[(p)]`, `datetime[(p)]`, `timestamp[(p)]` | `Time`/`TimeP(p)`, `Timestamp`/`TimestampP(p)`, `TimestampTz`/`TimestampTzP(p)` |
| `decimal(p,s)`, `numeric(p,s)` | `Decimal(p, s)` |
| `year` | `Custom("year")` |
| a column whose collation differs from the table's | `Collated(inner, collation)` |
| anything else | `Custom(column_type)` |

The `Custom` names are deliberate: a signed `TINYINT`, a `MEDIUMINT`, a `YEAR`, a `LONGTEXT` and
a `LONGBLOB` are narrower or wider than the canonical type they would otherwise flatten onto, so
the snapshot recreates the column that really exists. The differ folds those names back —
`tinyint` and `year` to `Int2`, `mediumint` to `Int4`, `*text` to `Text`, `*blob` to `Bytes` — so
a declared `i8` or `String` still converges against them.

## Custom types

MySQL's inline `ENUM(...)` and `SET(...)` keep their native spelling, so a column arrives as
`Custom("enum('a','b')")`. They belong to the column rather than to the schema, so
`Schema::enums` is empty on MySQL and there is no derive spelling for one. Anything newer than
the dialect knows about — `GEOMETRY`, a `VECTOR` column — is `Custom` for the same reason. The
DDL round-trips; the value cannot be decoded into Rust.

Custom column types are tracked in [#98](https://github.com/specta-rs/besu/issues/98), and
inline enums in [#102](https://github.com/specta-rs/besu/issues/102).

## Gotchas

- `BOOLEAN` is an alias for `TINYINT(1)`. A `tinyint(1)` column introspects as `Bool`, except
  `tinyint(1) unsigned`, which is a `u8` and introspects as `UInt(8)`. A signed `tinyint` of
  another width stays `Custom("tinyint")`, so a snapshot recreates `TINYINT` rather than the
  wider `SMALLINT`.
- A `UNIQUE` on a `String` is a prefix key over 255 characters. Two rows that agree in the first
  255 characters collide even when the full values differ.
- A `UNIQUE` on a `JSON` column renders nothing, so the schema reports drift on every push.
- `TIMESTAMP` columns introspect as `TimestampTz`, so a snapshot of one renders `DATETIME(6)`
  when it is used to create a fresh table. Keep the choice of column type in a migration rather
  than round-tripping it.
- An `ON UPDATE CURRENT_TIMESTAMP` clause is reported as part of the column's default
  (`DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`), which is the one place the IR can
  carry it. A column with `ON UPDATE` and no default is reported without the clause.
- MySQL has no array type. A `Vec<T>` field renders `TEXT` and binding an array is an error
  before the statement is sent, so store a collection as `JSON` and use the JSON helpers.
- A `BLOB` or `TEXT` index needs a prefix length, and `CREATE INDEX` cannot know the column's
  type, so the DDL generator writes indexes inside `CREATE TABLE`.
