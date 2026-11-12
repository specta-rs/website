---
title: "Custom types"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/custom-types.md"
---

A custom column type is a marker type that names a SQL type, plus a Rust type that carries the
value. The marker is zero-sized and compile-time only; the Rust type is what rows and
parameters are made of.

## Naming an existing marker

`#[besu(sql_type = "..")]` takes a path to a `SqlType` implementation and uses its `DEF` for
DDL, casts and migration diffing. The field type should be that marker's `Rust` type; the
derive does not check it, which matters for reading rows. The attribute is described in
[Declaring a schema](../schema/declaration#sql_type).

```rust
#[derive(Table)]
#[besu(table = "articles")]
pub struct Article {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(sql_type = "besu::VarChar<64>")]
    pub slug: String,
    #[besu(sql_type = "besu::Decimal<10, 2>")]
    pub price: String,
}
```

`VarChar<64>` renders `VARCHAR(64)` on PostgreSQL and MySQL and `TEXT` on SQLite, whose
storage classes have no length. `Decimal<10, 2>` renders `NUMERIC(10,2)` and `DECIMAL(10,2)`,
but no driver decodes that back into a `String` yet, so a decimal column can be declared and
created and cannot be read on PostgreSQL or MySQL. On SQLite it is stored as `TEXT` and works.

The path is resolved where the derive is used, so `crate::types::Money` and
`besu::VarChar<64>` both work.

## Declaring your own marker

A marker is a struct with no fields and two associated items: the canonical `DEF` and the
`Rust` type. Nothing else is required, and a marker over `TEXT` is complete on its own.

```rust
pub struct Slug;

impl besu::SqlType for Slug {
    const DEF: besu::TypeDef = besu::TypeDef::Text;
    type Rust = String;
}

#[derive(Table)]
#[besu(table = "posts")]
pub struct Post {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(sql_type = "Slug")]
    pub slug: String,
}
```

This is the cheap custom type: the value stays a `String`, every driver already decodes a
string, and the marker only exists to give the column a name in your own code. Filtering still
needs an `IntoSqlValue<Slug>` implementation, because the comparison helpers are implemented
per `(Rust type, SQL type)` pair rather than by conversion:

```rust
impl besu::expr::IntoSqlValue<Slug> for String {
    fn into_sql_value(self) -> besu::Value {
        besu::Value::Text(self)
    }
}
```

## A type with its own Rust value

When the value is not a `String`, the marker's `Rust` is your own type and three things are
needed: the marker, a conversion into `Value` for binding, and one `Decode` implementation per
driver for reading.

```rust
use std::borrow::Cow;
use std::net::IpAddr;

pub struct Inet;

impl besu::SqlType for Inet {
    // Printed verbatim by every dialect, so the database's own spelling is the type name.
    const DEF: besu::TypeDef = besu::TypeDef::Custom(Cow::Borrowed("inet"));
    type Rust = InetAddr;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct InetAddr(pub IpAddr);

impl From<InetAddr> for besu::Value {
    fn from(value: InetAddr) -> Self {
        besu::Value::Text(value.0.to_string())
    }
}
```

`SqlType::Rust` requires `Into<Value>`, which the `From` implementation supplies. The bound is
on the marker, so a type that cannot be bound as a parameter cannot be a column type.

Decoding is per driver because a row is the driver's own type. This is the PostgreSQL one:

```rust
impl besu::Decode<besu_postgres::Sqlx> for InetAddr {
    fn decode(
        row: &sqlx::postgres::PgRow,
        offset: &mut usize,
    ) -> Result<Self, sqlx::Error> {
        use sqlx::Row;

        let index = *offset;
        *offset += 1;
        let text: String = row.try_get(index)?;

        text.parse()
            .map(Self)
            .map_err(|err| sqlx::Error::Decode(Box::new(err)))
    }
}
```

Two rules make a `Decode` correct: read exactly one column, and advance `*offset` by exactly
`Self::COLUMNS` (one, by default). `Option<InetAddr>` then works for a nullable column and for
the outer side of a join without another implementation.

```rust
#[derive(Table)]
#[besu(table = "hosts")]
pub struct Host {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(sql_type = "Inet")]
    pub address: InetAddr,
}

let addresses: Vec<InetAddr> = db.select(hosts).pick(hosts.address).await?;
```

## What is checked

| Mistake | When it fails |
| --- | --- |
| A field type that is not `Rust` | Nothing at compile time; the row type and `pick` disagree |
| A marker with no `Into<Value>` for `Rust` | Compile error at `impl SqlType` |
| A missing `Decode` for the driver | Compile error where the model is awaited |
| A `Decode` that advances `offset` by the wrong amount | Runtime; the next column is read from the wrong place |
| Comparing a custom column without `IntoSqlValue` | Compile error at the comparison |

## Gotchas

- **There are no codecs.** Parity lists codecs as absent, and the reason is structural: a row
  is a driver type, so decoding is a driver responsibility. One `impl Decode<Dr>` per driver is
  the design, not a stopgap.
- **Naming the row type means depending on sqlx.** The driver re-exports nothing for this; the
  `impl` names `sqlx::postgres::PgRow`, so the `sqlx` crate has to be a direct dependency of
  the crate that writes the impl.
- **`Custom` is rendered verbatim.** `TypeDef::Custom("inet")` produces `inet` in DDL and in a
  `CAST`; a typo becomes a database error, and a type the server does not have cannot be
  created.
- **Introspection keeps an unknown type by name.** PostgreSQL reports `inet` as `inet` and
  MySQL reports an unknown type as its own spelling, so a hand-declared `Custom` name
  round-trips through `push` when it matches exactly.
- **The value's text form is your encoding.** A type that binds as `Value::Text` but is
  decoded from a native binary representation — a UUID, for instance — will not round-trip
  unless the two halves agree.
- **A custom marker does not add validation.** `Slug` is a `String` at run time; enforcing the
  shape is your code, an `impl TryFrom`, or a `CHECK` constraint in a migration.
