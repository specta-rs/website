---
title: "Transactions"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/transactions.md"
---

A transaction runs several statements on one connection and makes them visible together, or
not at all. Besu exposes the driver's transaction rather than inventing a second one, so the
isolation level, the error type and the rollback behaviour are the database's own.

## Begin, commit, rollback

`Database::begin` is available when the driver implements `TransactionDriver`. Every
supported driver does.

```rust
let mut tx = db.begin().await?;

tx.insert(users)
    .value(users.insert("oscar@example.com", "Oscar", 21))
    .await?;

tx.update(users)
    .set(users.age, 22)
    .filter(users.email.eq("oscar@example.com"))
    .await?;

tx.commit().await?;
```

Inside the transaction the query surface is the same as the database's: `select`, `insert`,
`update`, `delete`, `stream` and `execute` for a raw fragment.

```rust
tx.select(users).filter(users.age.gte(18)).await?;
tx.insert(users).value(users.insert(..)).await?;
tx.update(users).set(users.age, 22).all_rows().await?;
tx.delete(users).filter(users.id.eq(7)).await?;
tx.execute(sql!("SELECT 1")).all::<(i64,)>().await?;
```

`commit` and `rollback` take the transaction by value, so a committed transaction cannot be
used again and a rolled-back one cannot be committed by accident.

```rust
tx.commit().await?;
// `tx` is gone; the compiler will not let you touch it.
```

Dropping a `Transaction` without committing rolls back. The underlying sqlx transaction does
that on drop and Besu does not change it. It is a safety net, not a substitute for saying what
you mean: an explicit `rollback` reports its error, a drop cannot.

## The `transaction()` helper

The common shape — begin, run a closure, commit on success, roll back on error — is built in.

```rust
let user_id: i64 = db
    .transaction(async |tx| {
        let user = tx
            .insert(users)
            .value(users.insert("oscar@example.com", "Oscar", 21))
            .returning(users)
            .await?
            .remove(0);

        Ok(user.id)
    })
    .await?;
```

The closure is an `AsyncFnOnce(&mut Transaction<'_, Dr>) -> Result<T, Dr::Error>`. Write it as
an async closure, as above; a plain closure returning an `async move` block does not satisfy
the higher-ranked borrow. On `Ok` the helper commits and returns the value. On `Err` it rolls
back and returns the original error; a failure of the rollback itself is discarded, because
the error you asked about is the useful one.

The error type is the driver's, so `?` works whenever the surrounding function returns that
type (or boxes it). Where inference needs help, name it:

```rust
db.transaction(async |tx| {
    tx.insert(users).value(users.insert(..)).await?;
    Ok::<(), sqlx::Error>(())
})
.await?;
```

## Why the closure receives the transaction

The helper owns the `Transaction` and lends it to the closure as `&mut`, for three concrete
reasons.

- **The helper has to decide the ending.** It can only commit or roll back if it still holds
  the handle after the closure returns. A closure that took the transaction by value would
  have to end it itself, and the error path would have nothing left to roll back.
- **The handle borrows the database.** `Transaction<'a, Dr>` borrows `&'a Dr`, so it cannot be
  moved out of the closure and returned past `'a`. A `&mut` keeps the borrow inside the scope
  where it is valid.
- **The closure runs once, not per row.** `AsyncFnOnce` means the body is not a retry loop and
  its captures are consumed.

## Isolation

Besu sets no isolation level. `begin()` issues the database's plain `BEGIN` (or
`START TRANSACTION`), so the level is whatever the server's default is, and there is no
`isolation(..)` method to change it. Set it inside the transaction before any other statement,
where the database allows that:

```rust
let mut tx = db.begin().await?;
tx.execute(sql!("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")).await?;
```

Each database spells and scopes this differently; Besu passes the statement through and does
not validate the level. A serialisation failure arrives as the driver's error and is never
retried.

## Savepoints

Every supported database spells a nested transaction as a *savepoint*.
`Transaction::transaction` opens one with a generated name, releases it on success, and on
error rolls back to it and returns the error. Work done before the savepoint stays in place.

```rust
db.transaction(async |tx| {
    tx.insert(users).value(users.insert(..)).await?;

    // The failure is swallowed, so only the audit insert is undone.
    let _ = tx
        .transaction(async |tx| {
            tx.insert(audit).value(audit.insert(..)).await?;
            Err::<(), _>(sqlx::Error::Protocol("audit unavailable".into()))
        })
        .await;

    Ok::<(), sqlx::Error>(())
})
.await?;
```

`Transaction::savepoint(name, ..)` is the same with a name you choose, which is what you want
when several nest.

```rust
// inside a transaction
tx.savepoint("import_batch", async |tx| {
    tx.insert(imports).values(..).await?;
    Ok::<(), sqlx::Error>(())
})
.await?;
```

The name is written into `SAVEPOINT`, `RELEASE SAVEPOINT` and `ROLLBACK TO SAVEPOINT` rather
than quoted, so it is checked instead of escaped: non-empty, at most 64 bytes, the first byte
an ASCII letter, the rest ASCII letters, digits or underscores. Anything else is an
`Error::InvalidQuery` returned through the driver's error type, before a statement runs.

A savepoint needs no guard object. There is nothing to forget to drop: one that is neither
released nor rolled back is released when the enclosing transaction commits, and the closure
already gives the release point a scope. A `Drop` guard could not release it anyway, because
`RELEASE SAVEPOINT` is asynchronous.

## What is not here

- **No isolation-level API.** See above; use SQL or the connection's own configuration.
- **No implicit retry.** A deadlock or serialisation failure is returned, not retried.
- **No two-phase commit.** A transaction is one connection.
- **Migrations are already transactional.** `Database::migrate` begins a transaction, runs the
  whole set on it, and commits or rolls back.

## What is checked

| Mistake | When it fails |
| --- | --- |
| Using a transaction after `commit` or `rollback` | Compile error: both consume `self` |
| Moving the `Database` while a transaction is alive | Compile error: the transaction borrows it |
| A savepoint name containing a space or `;` | Runtime error before any statement |
| A statement issued on `db` instead of `tx` | No error; it may silently miss the transaction's rows |
| Keeping the transaction after the closure returns | Compile error: the `&mut` borrow ends with the closure |

## Gotchas

- **Do not use `db` for work that belongs to `tx`.** On a pool, `db` checks out a different
  connection and cannot see uncommitted data. On SQLite in-memory, `Sqlx::memory()` pins the
  pool to one connection, so the two may accidentally work — do not rely on it.
- **`commit` can fail.** A deferred constraint or a lost connection surfaces there, after
  every statement succeeded. Handle the error from `commit`, not only the ones inside the
  transaction.
- **Rollback on drop is best-effort.** If you care whether the rollback succeeded, call
  `rollback().await` and handle the error.
- **Generated savepoint names start at `besu_savepoint_0`.** Do not name your own savepoints
  with that prefix; a later `tx.transaction(..)` can reuse the name and make the earlier
  savepoint unreachable.
- **A savepoint rollback that itself fails is swallowed.** The original error is returned, so
  the transaction may be in a worse state than the error suggests. Fail the whole transaction
  if that matters.
- **Isolation is not emulated.** `SET TRANSACTION` on a database that does not accept it is a
  database error, not a Besu error.
