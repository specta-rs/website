---
title: "`besu check`"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/migrations/check.md"
---

> **Not supported yet.** There is no `check` subcommand. The CLI's own commands are `pull`,
> `push`, `generate` and `migrate`.

Drizzle Kit's `check` compares the migrations folder against the schema and reports what is
inconsistent. Besu has no command that does that ahead of time. The equivalent checks happen
when the diff is computed or when the runner starts.

## The schema equivalent

`besu push --dry-run` prints the plan without running it, which is the closest thing to a
check of one snapshot against one database:

```sh
besu push --database postgres://user:pass@host/db --schema schema.json --dry-run
```

```text
[safe] create table users
[risky] add column users.bio
```

The output `schema is up to date` means the snapshot matches. In code, the same diff is
available directly:

```rust
use besu::TypeDef;
use besu::schema::{Schema, diff_with};

let current = db.introspect().await?;
let desired = Schema::load("schema.json")?;
let changes = diff_with(&current, &desired, &|ty: &TypeDef| ty.clone());

if changes.is_empty() {
    println!("schema is up to date");
} else {
    for change in &changes {
        println!("[{:?}] {change}", change.safety());
    }
}
```

Pass the target dialect's `normalise_type` as the third argument, or use
`db.push_schema(&desired)` and inspect the result, to get the folding `push` would apply.

## The migration equivalent

An edited migration is caught when the runner opens the journal, not by a separate command:

```rust
let migrator = besu::schema::Migrator::from_dir("migrations")?;
let applied = db.migrate(&migrator).await?;
```

A checksum mismatch stops the run before any statement, with the recorded and current digest.
The runner also rejects two files with the same version, and `Migrator::from_dir` rejects a
`.down.sql` with no up file. Run `besu migrate` against a copy of the database to exercise
those checks without touching the real one.

## Gotchas

- **A dry run still connects.** `--dry-run` introspects the live database, so it fails
  against an unreachable URL.
- **The diff is not a verdict.** It reports what would change, not whether the change is
  safe. A `Destructive` line in the output is the signal to stop.
- **There is no check of the migrations directory against the snapshot.** Nothing compares
  the applied files with the schema your code declares.
