---
title: "Writing a driver"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/drivers.md"
---

A driver is two things: a `Dialect`, which knows how a database spells SQL, and a `Driver`,
which knows how to run it. Keeping them apart is what lets Besu render a complete statement
with no database attached — the tests and the CLI depend on that.

`besu-sqlite` is the smallest complete driver; `besu-postgres` and `besu-mysql` follow the
same shape. Read one of them alongside this page.

## The traits

| Trait | Crate | Responsibility |
| --- | --- | --- |
| `Dialect` | `besu-core` | Placeholders, identifier quoting, capability flags, type names |
| `Driver` | `besu-core` | Execution and row access |
| `TransactionDriver` | `besu-core` | `begin`, `commit`, `rollback`, queries inside a transaction |
| `Decode<D>` | `besu-core` | Turning one column, or a whole row, into a Rust value |
| `SchemaDriver` | `besu` | Introspection, plus an associated `Ddl` |
| `Ddl` | `besu-schema` | Rendering a `Schema` or a list of `Change`s as SQL |

`Driver`, `Dialect` and `Decode` have no dependency on the query builders. A driver crate
depends on `besu-core`, on `besu-schema` for DDL, and on `besu` only to implement
`SchemaDriver`.

## `Dialect`

```rust
pub trait Dialect: 'static + Sized {
    type Value: Clone + PartialEq + Send + Sync + core::fmt::Debug + 'static;

    const NAME: &'static str;
    const PLACEHOLDER: Placeholder;
    const SUPPORTS_RETURNING: bool;
    const SUPPORTS_ILIKE: bool;
    const SUPPORTS_FULL_JOIN: bool;
    const SUPPORTS_ALTER_COLUMN_TYPE: bool = true;
    const REQUIRES_LIMIT_WITH_OFFSET: bool = false;
    const SUPPORTS_NULLS_ORDER: bool = true;
    const SUPPORTS_DEFAULT_IN_VALUES: bool = true;
    const UNBOUNDED_LIMIT: i64 = -1;
    const UPSERT: UpsertStyle;
    const SUPPORTS_DELETE_LIMIT: bool = true;
    const MAX_PARAMS: usize = 65_535;
    const SUPPORTS_RIGHT_JOIN: bool = true;
    const SUPPORTS_ROW_LOCKING: bool = true;

    fn bind(value: Value) -> Result<Self::Value, Error>;
    fn write_placeholder(out: &mut String, index: usize);

    fn quote(ident: &str) -> String { /* double-quote, doubling internal quotes */ }
    fn write_ident(out: &mut String, ident: &str) { /* same, in place */ }

    fn type_name(ty: TypeDef) -> Cow<'static, str>;
}
```

A dialect is a type, not a value: it has no state and exactly one instance. Every method must
be total with respect to *expression*: it never fails because it cannot spell a construct.
`bind` is the exception in form — it returns `Result` so a value the database cannot represent
(such as a `u64` above `i64::MAX` on SQLite) is an encode error rather than a truncation. When
the database genuinely cannot express a construct (MySQL has no `RETURNING`), the capability
constants let the builder reject the query with a clear error before it is sent.

| Constant | What the query layer does with it |
| --- | --- |
| `PLACEHOLDER` | Chooses the spelling written by `write_placeholder` |
| `SUPPORTS_RETURNING` | Rejects `RETURNING` where it does not exist |
| `SUPPORTS_ILIKE` | Rejects `ILIKE` / `NOT ILIKE` |
| `SUPPORTS_FULL_JOIN` | Rejects `FULL OUTER JOIN` |
| `SUPPORTS_RIGHT_JOIN` | Rejects `RIGHT JOIN` |
| `SUPPORTS_NULLS_ORDER` | Emulates `NULLS FIRST` / `NULLS LAST` with `expr IS NULL` |
| `REQUIRES_LIMIT_WITH_OFFSET` | Writes `LIMIT UNBOUNDED_LIMIT` when only an offset is set |
| `SUPPORTS_DEFAULT_IN_VALUES` | Decides whether a ragged bulk insert is possible |
| `SUPPORTS_DELETE_LIMIT` | Rejects `DELETE ... LIMIT` |
| `SUPPORTS_ROW_LOCKING` | Rejects `FOR UPDATE` / `FOR SHARE` |
| `UPSERT` | Chooses `ON CONFLICT` or `ON DUPLICATE KEY UPDATE` |
| `MAX_PARAMS` | Rejects a bulk insert with too many bound values |
| `SUPPORTS_ALTER_COLUMN_TYPE` | Reserved; DDL decides with `Ddl::can_alter_column` |

`Placeholder` is `Question`, `QuestionNumbered` or `Dollar`. `UpsertStyle` is `OnConflict` or
`OnDuplicateKey`.

`type_name` is used by `CAST` and by DDL. It must return the database's native spelling:
`BIGINT`, `DOUBLE PRECISION`, `TIMESTAMPTZ`, and so on.

### A real dialect

The SQLite one is small enough to read in full:

```rust
impl Dialect for SQLite {
    type Value = Value;

    const NAME: &'static str = "sqlite";
    const PLACEHOLDER: Placeholder = Placeholder::Question;
    const SUPPORTS_RETURNING: bool = true;
    const SUPPORTS_ILIKE: bool = false;
    const SUPPORTS_FULL_JOIN: bool = true;
    const SUPPORTS_DEFAULT_IN_VALUES: bool = false;
    const UPSERT: UpsertStyle = UpsertStyle::OnConflict;
    const SUPPORTS_ROW_LOCKING: bool = false;
    const MAX_PARAMS: usize = 32_766;

    fn bind(value: Value) -> Result<Self::Value, Error> {
        sqlite_bind(value)
    }

    fn write_placeholder(out: &mut String, _index: usize) {
        out.push('?');
    }

    fn type_name(ty: TypeDef) -> Cow<'static, str> {
        Cow::Borrowed(match ty {
            TypeDef::Bool => "BOOLEAN",
            TypeDef::Int2 | TypeDef::Int4 | TypeDef::Int8 => "INTEGER",
            TypeDef::Float4 | TypeDef::Float8 => "REAL",
            TypeDef::Text | TypeDef::Char(_) | TypeDef::VarChar(_) => "TEXT",
            TypeDef::Bytes | TypeDef::Uuid => "BLOB",
            TypeDef::Json | TypeDef::Jsonb => "TEXT",
            TypeDef::Date | TypeDef::Time | TypeDef::Timestamp | TypeDef::TimestampTz => "TEXT",
            TypeDef::Decimal(_, _) => "NUMERIC",
            TypeDef::Custom(ref name) => return name.clone(),
            _ => "TEXT",
        })
    }
}
```

SQLite's `bind` rejects a `u64` that does not fit in an `i64`, because the database has no type
that could hold it. That is the shape of a real encode check: return `Error::encode(value,
reason)` rather than truncating.

## `Driver`

```rust
pub trait Driver: Clone + Send + Sync + 'static {
    type Dialect: Dialect;
    type Error: core::error::Error + Send + Sync + 'static;
    type Row: Send + 'static;
    type Output: Send + 'static;

    fn error(err: Error) -> Self::Error;
    fn row_len(row: &Self::Row) -> usize;
    fn is_null(row: &Self::Row, index: usize) -> bool;

    fn query(
        &self,
        sql: &Sql<Self::Dialect>,
    ) -> impl Future<Output = Result<Vec<Self::Row>, Self::Error>> + Send;

    fn execute(
        &self,
        sql: &Sql<Self::Dialect>,
    ) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send;
}
```

- `Error` is the only error type callers see. A build error, an encode failure and a decode
  failure all arrive through `Self::Error`, so a query has one `?` type.
- `Row` is whatever the database's result API hands back; `is_null` and `Decode` are the only
  things that inspect it.
- `Output` is what a row-less statement reports: affected rows, a command tag, `()`.
- `error` converts a `besu_core::Error` into the driver's error. SQLite wraps it in
  `sqlx::Error::Protocol`.
- `query`/`execute` take `&self`, so a pool can be cloned freely and a connection can be
  shared. They return `impl Future + Send`, which lets a query be awaited from a `Send`
  context.

The `Sql` passed in is already rendered for `Self::Dialect`: `sql.sql()` is the text and
`sql.args()` is the slice of bound values, already converted by `Dialect::bind`. A driver
never sees an unbound value. If you want the same checks the builders use, call
`sql.render()` and handle the error before executing.

```rust
impl Driver for Sqlx {
    type Dialect = SQLite;
    type Error = sqlx::Error;
    type Row = SqliteRow;
    type Output = SqliteQueryResult;

    fn error(err: Error) -> Self::Error {
        sqlx::Error::Protocol(err.to_string())
    }

    fn row_len(row: &Self::Row) -> usize {
        row.len()
    }

    fn is_null(row: &Self::Row, index: usize) -> bool {
        row.try_get_raw(index)
            .map(|value| sqlx::ValueRef::is_null(&value))
            .unwrap_or(true)
    }

    async fn query(&self, sql: &Sql<SQLite>) -> Result<Vec<Self::Row>, Self::Error> {
        let arguments = arguments(sql)?;
        sqlx::query_with(sql.sql(), arguments)
            .fetch_all(&self.pool)
            .await
    }

    async fn execute(&self, sql: &Sql<SQLite>) -> Result<Self::Output, Self::Error> {
        let arguments = arguments(sql)?;
        sqlx::query_with(sql.sql(), arguments)
            .execute(&self.pool)
            .await
    }
}
```

`is_null` must not fail: an out-of-range index reports `true`. That is what makes an
outer-joined row decode as `None` instead of erroring when a driver hands back a short row.

`row_len` is part of the row-access contract even though the current `Decode` path walks the
offset itself. Implement it as the real column count.

## `Decode`

```rust
pub trait Decode<D: Driver>: Sized {
    const COLUMNS: usize = 1;

    fn decode(row: &D::Row, offset: &mut usize) -> Result<Self, D::Error>;
}
```

The contract: start at `*offset`, decode `Self::COLUMNS` columns, and advance `*offset` by
exactly that many. A scalar consumes one column; a tuple consumes the sum of its elements; the
`#[derive(Table)]` model consumes one per field.

Two implementations are provided for you:

- `Option<T>` peeks at `T::COLUMNS` columns with `D::is_null`, returns `None` and advances if
  they are all `NULL`, and otherwise decodes `T`.
- Tuples decode each element in order.

Everything else is database-specific and belongs in the driver. The SQLite driver, for
example, has one `impl Decode<Sqlx>` per primitive, generated by a small macro around this
helper:

```rust
fn decode_via_sqlx<T>(row: &SqliteRow, offset: &mut usize) -> Result<T, sqlx::Error>
where
    T: for<'r> sqlx::Decode<'r, Sqlite> + sqlx::Type<Sqlite>,
{
    let index = *offset;
    *offset += 1;
    row.try_get(index)
}
```

The macro expands to an impl like this for `i64`:

```rust
impl Decode<Sqlx> for i64 {
    fn decode(row: &SqliteRow, offset: &mut usize) -> Result<Self, sqlx::Error> {
        decode_via_sqlx(row, offset)
    }
}
```

A decode failure should become `D::error(Error::decode(index, reason))`. The index in the
error is the column that failed, which is the only useful location a row decoder can report.

A model does not need a hand-written `Decode` at all: the derive emits one with a bound per
field, so the model is decodable exactly when every field type is.

## `TransactionDriver`

```rust
pub trait TransactionDriver: Driver {
    type Transaction<'a>: Send + 'a where Self: 'a;

    fn begin<'a>(&'a self)
        -> impl Future<Output = Result<Self::Transaction<'a>, Self::Error>> + Send;
    fn commit<'a>(tx: Self::Transaction<'a>)
        -> impl Future<Output = Result<(), Self::Error>> + Send;
    fn rollback<'a>(tx: Self::Transaction<'a>)
        -> impl Future<Output = Result<(), Self::Error>> + Send;

    fn txn_query<'c, 'a>(
        tx: &'c mut Self::Transaction<'a>,
        sql: &Sql<Self::Dialect>,
    ) -> impl Future<Output = Result<Vec<Self::Row>, Self::Error>> + Send;

    fn txn_execute<'c, 'a>(
        tx: &'c mut Self::Transaction<'a>,
        sql: &Sql<Self::Dialect>,
    ) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send;
}
```

Transactions are a separate trait because not every database can offer them and because a
read-only driver should not be forced to implement them. `commit` and `rollback` consume the
transaction handle; that is what makes a double commit impossible.

The executor impls are what connect this to the builders:

```rust
impl<Dr: Driver> Executor for &Database<Dr> { /* ... */ }
impl<'a, Dr: TransactionDriver> Executor for &mut Transaction<'a, Dr> { /* ... */ }
```

A query builder is generic over `Executor`, so the same builder runs on a pool, on a
transaction, or on nothing at all (`DryDriver`).

## `SchemaDriver` and `Ddl`

Migrations and the CLI need two more things: a way to read the live schema, and a way to
render DDL.

```rust
pub trait SchemaDriver: Driver {
    type Ddl: Ddl + Default;
    fn introspect(&self) -> impl Future<Output = Result<Schema, Self::Error>> + Send;
}
```

```rust
impl SchemaDriver for Sqlx {
    type Ddl = SQLiteDdl;

    async fn introspect(&self) -> Result<Schema, Self::Error> {
        let db = besu::Database::new(self.clone());
        crate::introspect::introspect(&db).await
    }
}
```

`Ddl` has working defaults for everything except `name`, `quote`, `type_name` and
`column_sql`:

```rust
pub trait Ddl {
    fn name(&self) -> &'static str;
    fn quote(&self, ident: &str) -> String;
    fn type_name(&self, ty: &TypeDef) -> String;
    fn column_sql(&self, column: &Column, inline_pk: bool) -> String;

    fn normalise_type(&self, ty: &TypeDef) -> TypeDef { ty.clone() }

    const INLINE_INDEXES: bool = false;
    const CREATE_INDEX_NEEDS_TYPES: bool = false;

    fn quote_table(&self, table: &str) -> String { /* schema.name */ }
    fn literal(&self, value: &Value) -> String { /* SQL literal */ }
    fn create_table(&self, table: &Table) -> String { /* ... */ }
    fn drop_table(&self, table: &str) -> String { /* ... */ }
    fn add_column(&self, table: &str, column: &Column) -> String { /* ... */ }
    fn drop_column(&self, table: &str, column: &str) -> String { /* ... */ }
    fn can_alter_column(&self) -> bool { true }
    fn alter_column(&self, table: &str, from: &Column, to: &Column) -> Vec<String> {
        /* default: drop + add */
    }
    fn create_index(&self, table: &str, index: &Index) -> String { /* ... */ }
    fn drop_index(&self, table: &str, index: &Index) -> String { /* ... */ }
    fn foreign_key_clause(&self, fk: &ForeignKey) -> String { /* ... */ }
    fn add_foreign_key(&self, table: &str, fk: &ForeignKey) -> String { /* ... */ }
    fn drop_foreign_key(&self, table: &str, fk: &ForeignKey) -> String { /* ... */ }
    fn change(&self, change: &Change) -> Vec<String> { self.default_change(change) }
    fn default_change(&self, change: &Change) -> Vec<String> { /* dispatch */ }
    fn create_schema(&self, schema: &Schema) -> Vec<String> { /* ... */ }
    fn apply(&self, changes: &[Change]) -> Vec<String> { /* ... */ }
}
```

Three defaults matter in practice:

- `alter_column` is deliberately blunt: drop the old column and add the new one. Override it
  with a real `ALTER` (MySQL does this with `MODIFY COLUMN`), or set
  `can_alter_column() == false` and require an explicit migration (SQLite does this).
- `drop_index` for MySQL needs the table name, so the method receives it even though SQLite
  and PostgreSQL ignore it.
- `column_sql` is where each database's auto-increment spelling lives. PostgreSQL uses
  `GENERATED BY DEFAULT AS IDENTITY`, SQLite requires `INTEGER PRIMARY KEY AUTOINCREMENT`
  inline, MySQL uses `AUTO_INCREMENT`.
- `INLINE_INDEXES` tells `create_schema` whether `create_table` already wrote the secondary
  indexes. MySQL sets it because a `TEXT`/`BLOB` index needs a prefix length, which only the
  column types can supply. `CREATE_INDEX_NEEDS_TYPES` is declared for the same reason but is
  not yet read anywhere: `create_index` receives only the table name and the index, so a
  dialect that needs the column types has no hook for them yet.
- `change` delegates to `default_change`. Override `change` only for a dialect that handles a
  subset of changes differently; calling `self.change(..)` from inside it recurses forever.

`create_schema` creates the tables in dependency order and then their indexes, so a foreign
key can reference a table that has not been created yet.

Introspection must produce the same normalised IR that `diff` expects: canonical `TypeDef`s,
normalised defaults, primary-key-first columns, sorted indexes and foreign keys. If it does
not, `push` will report a change on every run. The SQLite driver reads `PRAGMA table_info`,
`PRAGMA index_list` and `PRAGMA foreign_key_list`; MySQL reads `information_schema`.

`normalise_type` is the dialect's answer to "which canonical types does the database store
identically?". `push` passes it to `diff_with`, so a database with one integer type must fold
every integer width, and a database without unsigned integers must fold each `UInt` onto the
signed type that holds it. The default is the identity, which is right for a database that
keeps the declared types faithfully.

## A worked example of the seam

`besu::logged(driver)` wraps any driver and reports every statement through `tracing`, with
timing and a slow-query warning. It implements `Driver`, `TransactionDriver` and `SchemaDriver`
by delegation, which is the whole point of the split: a middleware is a plain wrapper and the
query layer never learns it exists. Read `besu/src/logged.rs` after `besu-sqlite` — it is the
smallest way to see what a driver actually has to provide, and the cost design (check
`tracing::enabled!` before formatting anything) is worth copying.

## `execute_statements`

`SchemaDriver` has one method beyond `introspect`: `execute_statements`, which runs a list of
schema statements. The default runs them one at a time and is right for almost every database.
SQLite overrides it because its table rebuild toggles `PRAGMA foreign_keys`, a *per-connection*
setting — through a pool the `DROP TABLE` would land on a connection that still enforces
foreign keys and cascade into child rows. Override it when your statements only make sense
together.

## Choosing a driver at runtime

A query builder is compile-time over a dialect on purpose: the SQL a query produces depends on
the dialect, so one query cannot be shared between two databases that spell it differently.
What can be dynamic is everything around it.

`besu-any` provides `AnyDatabase`, chosen from a connection string:

```rust
use besu_any::AnyDatabase;

let db = AnyDatabase::connect(&std::env::var("DATABASE_URL")?).await?;
db.push_schema(&schema, false).await?;
db.migrate(&Migrator::from_dir("migrations")?).await?;
```

That covers migrations, schema push and raw statements, which is what a config-driven binary
actually needs. For typed queries, match on the variant — the dialect comes back as soon as you
name one — and write the query once as a generic function:

```rust
match db {
    AnyDatabase::Sqlite(db) => list_users(db).await,
    AnyDatabase::Postgres(db) => list_users(db).await,
    AnyDatabase::MySql(db) => list_users(db).await,
}

async fn list_users<Dr: besu::Driver>(db: &besu::Database<Dr>) -> Result<Vec<User>, Dr::Error>
where
    User: besu::Decode<Dr>,
{
    db.select(user).await
}
```

Type erasure is deliberately not offered: `Driver` has associated types and returns `impl
Future`, so erasing it means boxed rows, boxed futures and a runtime decoder — an allocation
per row to solve a problem the `match` already solves.

## Testing a new driver

1. **SQL without a database.** `besu::dry::<MyDialect>()` builds every query and never
   executes it. Assert on `sql.sql()` and `sql.args()`. This catches placeholder and quoting
   mistakes before a server exists.
2. **Round-trip the schema.** Create a database, `push` the declared tables, then assert that
   a second `push` is empty and that `introspect` reports the columns, indexes and foreign
   keys you expect. `besu-sqlite/tests/query.rs` does exactly this in
   `schema_push_converges`.
3. **Decode every supported type.** The `Decode` impls are where a driver is most likely to
   be subtly wrong: an unsigned integer that wraps, a timestamp that loses its timezone, a
   `NULL` that becomes a zero.
4. **Test the capability errors.** Ask for `RETURNING` on a database without it, or
   `FOR UPDATE` on SQLite; the error should be the one you intended, not a database syntax
   error.

## Gotchas

- **`bind` is per value, not per statement.** Return `Error::encode` when a single value does
  not fit; do not silently clamp.
- **`write_placeholder`'s index is zero based.** PostgreSQL adds one to spell `$1`.
- **`type_name` serves both `CAST` and DDL.** MySQL's `CAST` accepts a much smaller set of
  target names than its DDL does, so a type map can be correct for `CREATE TABLE` and still
  produce an invalid `CAST`.
- **`is_null` must be infallible.** Return `true` for an index that is out of range rather
  than an error; `Option<T>` relies on it.
- **`row_len` and `Decode::COLUMNS` must agree.** A mismatch shows up as a decode that reads
  the wrong column, not as a clean error.
- **`MAX_PARAMS` is currently enforced for bulk inserts.** Individual statements are not
  pre-checked, so a query with a huge `IN` list still depends on the driver to reject it.
- **`Value` and `Error` are `#[non_exhaustive]`.** Match with a `_` arm; new variants are
  additive.
- **A driver's error type is part of its public API.** Wrapping `besu_core::Error` in the
  driver's own error keeps `?` usable; returning a boxed error loses the ability to match on
  encode versus decode failures.
