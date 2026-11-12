---
title: "Row-level security"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/rls.md"
---

PostgreSQL row-level security is a policy attached to a table. Besu records policies — so
`besu pull` writes them down and a snapshot round-trips them — but it never creates or drops one.
A policy is written in a migration, where its raw SQL is reviewed like any other change.

```sql
-- migrations/0007_tenant_isolation.sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_tenant ON documents
    USING (tenant_id = current_setting('app.tenant')::bigint);
```

```sql
-- migrations/0007_tenant_isolation.down.sql
DROP POLICY documents_tenant ON documents;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
```

A policy applies to a role or to `PUBLIC`, and `FORCE ROW LEVEL SECURITY` makes it apply to the
table's owner too. Both are ordinary SQL inside the same migration.

## What is modelled

`Schema::policies` is a list of [`Policy`] values:

| Field | Meaning |
| --- | --- |
| `table` | The table the policy applies to, qualified like a table |
| `name` | The policy's name, unique per table |
| `command` | `All`, `Select`, `Insert`, `Update` or `Delete` |
| `roles` | The roles it applies to; empty means `PUBLIC` |
| `using` | The `USING` expression, as PostgreSQL reports it |
| `with_check` | The `WITH CHECK` expression, as PostgreSQL reports it |

PostgreSQL introspection reads `pg_policies`, so a `besu pull` snapshot names every policy exactly
as it exists. `besu generate` and `push` ignore the list in both directions.

## Why the differ ignores a policy

A `USING` clause is raw SQL, and comparing two of them reliably would mean parsing PostgreSQL's
own output. Ignoring the list is the safe half of management: a `push` that was never told about
a policy cannot drop it, and a snapshot that records one documents the database without claiming
`push` will recreate it.

The same reasoning applies to `ENABLE ROW LEVEL SECURITY`, but there is one direction Besu can
safely take:

- A table marked `rls` in the declaration, or `#[besu(rls)]` on a model, gets
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` when it is created or when the flag first appears.
- RLS is **never disabled automatically**, even when the declaration does not mention it.
  Disabling RLS silently removes the guarantee every policy on the table depends on, so it stays
  a migration.

```rust
#[derive(Table)]
#[besu(table = "documents", rls)]
pub struct Document {
    #[besu(primary_key)]
    pub id: i64,
    pub tenant_id: i64,
}
```

The policy itself is still written by hand:

```sql
CREATE POLICY documents_tenant ON documents
    USING (tenant_id = current_setting('app.tenant')::bigint);
```

## Gotchas

- **Run migrations as the right role.** A superuser, or a role with `BYPASSRLS`, ignores
  policies, so a migration that tests them can appear to pass while a normal role is denied.
- **`ENABLE` is not `FORCE`.** The table owner bypasses policies unless `FORCE ROW LEVEL
  SECURITY` is set.
- **There is no `CREATE POLICY IF NOT EXISTS`.** Re-running a policy migration by hand fails;
  the journal is what stops it running twice.
- **A view over a protected table runs as its owner by default.** On PostgreSQL 15 and later,
  set `security_invoker = true` on the view; before that, filter inside the view.
- **Removing a table removes its policies.** `DROP TABLE` takes them with it, and `DROP COLUMN`
  fails while a policy names the column.

[`Policy`]: https://docs.rs/besu-schema/latest/besu_schema/struct.Policy.html
