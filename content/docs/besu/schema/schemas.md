---
title: "Table schemas"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/schemas.md"
---

A table's schema is part of its identity on PostgreSQL: `app.users` and `users` are two
different tables. Declare it with `#[besu(schema = "...")]`, and Besu qualifies every
statement it writes for that table.

```rust
use besu::prelude::*;
use besu_postgres::Sqlx;

mod scoped {
    use besu::prelude::*;

    #[derive(Table)]
    #[besu(table = "users", schema = "app")]
    pub struct AppUser {
        #[besu(primary_key)]
        pub id: i64,
        pub email: String,
    }
}

#[derive(Table)]
#[besu(table = "users")]
pub struct User {
    #[besu(primary_key)]
    pub id: i64,
    pub email: String,
}
```

The attribute is stored on `TableDef::schema`, so it travels with the handle into `Schema`.
The two declarations have to live in different modules, because the handle identifier comes
from the table name.

```rust
let schema = besu::Database::<Sqlx>::schema([users.def(), scoped::users.def()]);

let default = schema.find(None, "users").expect("the unqualified table");
let scoped = schema.find(Some("app"), "users").expect("the scoped table");
assert_ne!(default, scoped);
```

## Looking a table up

`Schema::find` is the identity the differ uses: `None` means the connection's default schema.
`Schema::get` takes the qualified spelling that a `Change` carries, and `Schema::table` is the
lenient lookup that prefers the unqualified table and falls back to the first name match.

```rust
let table = schema.find(Some("app"), "users");
let table = schema.get("app.users");
let table = schema.table("users");
```

## What introspection reports

PostgreSQL introspection asks the connection for `current_schema()`. A table in that schema
is reported with `schema: None`; a table anywhere else carries its real schema name.

```rust
let live = db.introspect().await?;

assert!(live.find(None, "users").is_some());
assert!(live.find(Some("app"), "users").is_some());
```

The default schema stays implicit on purpose. Naming it explicitly in `#[besu(schema =
"public")]` would make every declared table look like a different table from the one
introspection reports, and `push` would try to create a second copy.

If `search_path` is empty, `current_schema()` returns `NULL` and every table is reported with
its real schema.

## `CREATE SCHEMA` is not emitted

Besu qualifies names and creates tables inside a schema, but it never creates the schema
itself. `push` and `generate` have no statement for it. Create it once, in a migration or by
hand:

```sql
CREATE SCHEMA IF NOT EXISTS app;
```

```rust
db.execute(sql!("CREATE SCHEMA IF NOT EXISTS \"app\"")).await?;
```

The schema has to exist before a `push` that names it, or the `CREATE TABLE` fails.

## Which schemas `push` manages

`push` manages the default schema and every schema a declared table names. It does not manage
anything else:

- A table in a schema the snapshot never mentions is left alone, not reported as a
  `DropTable`. A shared database does not make every push destructive.
- Remove the last declared table of a schema and that schema is no longer managed, so the
  drop is not reported either. Drop the table by hand, or keep the schema named by another
  table.

```rust
// The snapshot only names the default schema, so `app.users` is not compared.
db.push_schema(&default_only).await?;
```

## On SQLite and MySQL

The same attribute is the namespace the backend understands:

- **SQLite** treats a schema as an attached database. Set it only if you have run
  `ATTACH DATABASE`; an unattached name fails when the statement runs.
- **MySQL** treats a schema as a database name.

Both render the name as a qualifier: `"app"."users"`.

## Gotchas

- **A schema is not a table prefix.** `Database::prefixed` rewrites table names for shared
  databases; `schema` qualifies them. Combining them applies the prefix to the table name and
  leaves the schema as written.
- **An enum type is qualified the same way.** An enum outside the default schema is named
  `schema.type` in `Schema::enums`, and a column of that type carries the qualified name.
- **Renaming a schema is not modelled.** It looks like dropping every table in the old schema
  and creating them in the new one. Use `ALTER SCHEMA ... RENAME TO ...` in a migration.
- **`push` never drops a schema.** Even when every table in it is dropped, the empty schema
  stays. `DROP SCHEMA` is migration SQL.
- **Views follow the same naming rule** and are diffed once the declaration names one; see [views](views).
