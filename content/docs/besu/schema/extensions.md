---
title: "Extensions"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/extensions.md"
---

`CREATE EXTENSION` changes a database's catalogue in ways Besu does not model. It is
migration SQL, by design: the differ never installs, upgrades or removes an extension, and
`push` does not know one exists.

> **Not supported yet.** An extension cannot be declared in Rust or diffed. See the
> [roadmap](../roadmap) and [Drizzle parity](../parity).

```sql
-- migrations/0001_extensions.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;
```

```sql
-- migrations/0001_extensions.down.sql
DROP EXTENSION IF EXISTS postgis;
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS citext;
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS pgcrypto;
```

A down file only succeeds once the columns that use these types are gone: `DROP EXTENSION`
fails while an object still depends on it. Drop the dependent table or column first, or add
`CASCADE`, which drops it for you.

PostgreSQL requires the privileges its own rules demand: some extensions are trusted and can
be installed by a database owner, others need a superuser.

## Functions

`pgcrypto` and `uuid-ossp` add functions, not column types. Use them where Besu already
allows an expression:

```rust
#[derive(Table)]
pub struct Invite {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    #[besu(default_sql = "gen_random_uuid()")]
    pub public_id: uuid::Uuid,
    #[besu(default_sql = "uuid_generate_v4()")]
    pub legacy_id: uuid::Uuid,
}
```

The default is inserted verbatim, so it is only valid once the extension exists.
`gen_random_uuid()` moved into PostgreSQL's core in version 13; `uuid_generate_v4()` is
`uuid-ossp`'s spelling on every version.

## Types

A type an extension adds arrives as `TypeDef::Custom(name)`, and Besu renders that name
verbatim. It can be created, introspected and compared. `citext` and PostGIS's `geometry` and
`geography` all take this path.

What Besu does not have is a `Decode` implementation for them, so reading one into a Rust
value needs a cast:

```rust
let names: Vec<String> = db
    .execute(sql!("SELECT name::text FROM places ORDER BY name"))
    .all()
    .await?;
```

## Gotchas

- **The extension must exist before the migration that uses it.** On a fresh database the
  extension migration has to run first; `push` will not create it.
- **A `citext` column is not a `String` column to the driver.** `citext` has its own type OID,
  so reading it without a `::text` cast fails at decode time. Declaring one in Rust needs a
  custom `SqlType` marker named with `#[besu(sql_type = "...")]`; a snapshot is the shorter
  path.
- **PostGIS loses its typmod.** A `geometry(Point, 4326)` column is reported as `geometry`,
  and DDL generated for it writes bare `geometry`. Create the column in a migration.
- **An index with an operator class is not modelled.** `USING gin (name gin_trgm_ops)` is
  reported as a plain index over `name`, because the IR records no access method and no
  operator class. A snapshot from `besu pull` round-trips it; a snapshot built from the derive
  does not contain it, and `besu generate` will write a `DROP INDEX` for it.
- **`push` will not drop an extension**, and it will not remove one either. There is no
  `DROP EXTENSION` in any generated plan.
