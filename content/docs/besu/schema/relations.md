---
title: "Relations"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/schema/relations.md"
---

A relation is the pair of columns that joins a parent row to its children. `has_many` names
that pair, and `Select::with` loads the children for every parent row with one extra
statement. Nothing is registered in the schema and nothing is hidden in a join.

```rust
use besu::prelude::*;

#[derive(Table)]
#[besu(table = "users")]
pub struct User {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    pub email: String,
    pub age: i32,
}

#[derive(Table)]
#[besu(table = "posts")]
pub struct Post {
    #[besu(primary_key, auto_increment)]
    pub id: i64,
    pub title: String,
    #[besu(references = "users.id", on_delete = "cascade")]
    pub author_id: i64,
}

let users_with_posts: Vec<(User, Vec<Post>)> = db
    .select(users)
    .filter(users.age.gt(18))
    .with(has_many(users.id, posts.author_id))
    .await?;
```

The result has one entry per parent row, in the parent query's order. The parent columns are
decoded into `User` and the children into a `Vec<Post>` beside it.

## The two statements

`with` runs the parent query and then one child query. On PostgreSQL that is:

```sql
SELECT "users"."id", "users"."email", "users"."age", "users"."id"
  FROM "users" WHERE ("users"."age" > $1);

SELECT "posts"."id", "posts"."title", "posts"."author_id", "posts"."author_id"
  FROM "posts" WHERE ("posts"."author_id" IN ($1, $2, $3));
```

The parent statement selects the columns it would have selected on its own, plus its key. The
child statement selects every declared child column, plus the foreign key again. The
repetition is deliberate: the model consumes its columns in declaration order, and the
trailing copy is where the loader reads the grouping key from.

Both statements are built and run independently, so each numbers its own placeholders from
the start. The keys are deduplicated before the second statement, so a parent result with
three distinct keys binds three parameters, however many parents there are.

## Why it is not a join

A join returns a tuple, `(User, Option<Post>)`, and repeats the same parent columns once per
child. Grouping those rows back into a `User` with its posts is left to the caller, and the
parent data crosses the wire once per child.

`with` returns `(User, Vec<Post>)` instead. It costs one extra round trip for the whole
result, not one per parent, and the parent row is sent once. This is why it is not N+1: the
child statement runs once regardless of how many parents matched. It does not run at all
when the parent result is empty, because `IN ()` is not portable and an empty query is not
worth a round trip.

## A parent with no children

Every parent row is present, with an empty `Vec` when nothing matched. A childless parent is
never missing from the result.

```rust
let loaded: Vec<(User, Vec<Post>)> = db
    .select(users)
    .with(has_many(users.id, posts.author_id))
    .await?;

// `loaded[i].1` is `Vec::new()`, not an absent entry.
```

## Filters, ordering and `pick`

The parent query keeps its filters, ordering, limit and projection. `with` only appends the
parent key to what is selected, so the key does not appear in `R`:

```rust
let loaded: Vec<(String, Vec<Post>)> = db
    .select(users)
    .filter(users.age.gte(18))
    .order_by(users.email.desc())
    .pick(users.email)
    .with(has_many(users.id, posts.author_id))
    .await?;
```

## Inspecting the SQL

`to_sql(keys)` renders both halves without running either. The keys stand in for the parents
a real load would have found:

```rust
let db = besu::dry::<besu_sqlite::SQLite>();

let (parent, child) = db
    .select(users)
    .filter(users.age.gt(18))
    .with(has_many(users.id, posts.author_id))
    .to_sql([3, 5, 9]);

assert_eq!(child.args().len(), 3);
```

## What is not modelled

- **Many-to-many.** A join table needs two column pairs, and no relation type describes that.
- **The other direction.** There is no `belongs_to`: a child does not carry a loaded parent.
  Query the parent by key, or use a join.
- **Nesting.** `with` takes one relation. A relation on the child table cannot be loaded by
  the same call.
- **Per-parent limits and ordering.** The child statement has no `ORDER BY` and no `LIMIT`.
  Members arrive in whatever order the database returned them; sort the `Vec` yourself, or
  issue the child query by hand.
- **Writing.** Inserting a parent and its children together is not part of this API.
- **Schema.** Nothing is stored on `TableDef`. The foreign key is a separate declaration, and
  a relation works whether or not the database enforces it.

> **Not supported yet.** Many-to-many, `belongs_to`, nested relations and per-parent limits.
> See the [roadmap](../roadmap) and [Drizzle parity](../parity).

## What is checked

- Both columns must exist on their tables, be `NonNull`, and share one `SqlType`. A nullable
  foreign key is a compile error; so is an `i64` key paired with an `i32` key.
- `with` is only available on a single-table `Select`. After an inner or left join the model
  type is a tuple, and the method is gone.
- The parent column is treated as a key. Nothing checks that it is unique, so a non-unique
  parent key will attach the same child to several parents.

## Gotchas

- The relation is not registered. It does not add a foreign key, and `push` does not know it
  exists.
- `with` is a second round trip, so it is not free under a very tight latency budget. The
  child half is one statement for the whole result, not one per row.
- A child row whose foreign key is `NULL` is outside the relation, because `has_many` takes
  two `NonNull` columns. Declare the key non-null, or query those children separately.
- The child statement binds one parameter per distinct key. A parent result with more
  distinct keys than the database's parameter limit allows will fail at build time; narrow
  the parent query.
