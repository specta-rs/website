---
title: "Read replicas"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/read-replicas.md"
---

A read replica is a second database that follows the primary. Besu has no routing layer: you
create a second `Database` over a second connection and decide, at each call site, which one
the query runs on.

## Two databases

Each `Database` wraps one driver, and a driver wraps one pool. Two connection strings produce
two independent pools.

```rust
let primary = besu::Database::new(besu_postgres::Sqlx::connect(&primary_url).await?);
let replica = besu::Database::new(besu_postgres::Sqlx::connect(&replica_url).await?);
```

`Sqlx` is the same type for both, so every helper written against
`&Database<besu_postgres::Sqlx>` accepts either.

```rust
async fn find_user(
    db: &besu::Database<besu_postgres::Sqlx>,
    id: i64,
) -> Result<Option<User>, sqlx::Error> {
    db.select(users).filter(users.id.eq(id)).first().await
}

let cached = find_user(&replica, 1).await?;
let own = find_user(&primary, 2).await?;
```

## Routing reads and writes

There is no `read()` / `write()` split and no annotation that marks a query as read-only. The
routing is ordinary code: writes and anything that must be current go to the primary, and
tolerant reads go to the replica.

```rust
// A write, and the read that depends on it.
primary
    .insert(users)
    .value(users.insert("oscar@example.com", "Oscar", 21))
    .await?;

let user: Option<User> = primary
    .select(users)
    .filter(users.email.eq("oscar@example.com"))
    .first()
    .await?;

// A dashboard count that can be a few seconds stale.
let total: i64 = replica.select(users).pick(count_all()).await?.remove(0);
```

Read-your-own-writes is the trap. A replica lags, so a row inserted on the primary may not be
visible there yet. Read the row back from the primary when the request depends on it, or carry
the value you already have instead of re-reading it.

## Transactions stay on one database

A transaction is one connection, so it is one database. A read that must see the
transaction's own uncommitted writes has to go through `tx`; the replica is a different
connection with a different view, and it lags.

```rust
primary
    .transaction(async |tx| {
        tx.insert(users).value(users.insert(..)).await?;
        // Read through `tx`, never through `replica`.
        let count = tx.select(users).pick(count_all()).await?;
        Ok::<_, sqlx::Error>(count)
    })
    .await?;
```

## What is not here

- **No automatic failover.** If the primary is unreachable, the error is the driver's; nothing
  promotes the replica.
- **No lag tracking.** Besu cannot tell you how far behind a replica is, and does not wait for
  it.
- **No load balancing.** Two calls to the replica use one pool; how its connections are
  distributed is sqlx's business.
- **No read-only enforcement.** A `Database` over a replica will happily accept an insert; the
  server must be configured to refuse it.

## Gotchas

- **A replica URL is not a replica.** Pointing a second `Database` at the same server gives you
  a second pool, not replication; the split is the deployment's.
- **Sharing across tasks needs an `Arc`.** `Database` is not `Clone`, but it is `Send + Sync`,
  so `Arc<Database<Dr>>` can be cloned into tasks and dereferences to the `&Database` a query
  needs.
- **The pool size multiplies.** Each database opens its own pool, so two replicas plus a
  primary can be three times the connections the server expects.
- **A migration runs where you point it.** Run the migrator against the primary, not the
  replica; a replica usually refuses DDL, and a migration applied to one is not replicated.
