---
title: "Common table expressions"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/advanced/ctes.md"
---

A common table expression names a query so the rest of the statement can read it as if it
were a table. `Select::cte(name)` produces the handle, and the statement that uses it renders
the `WITH` clause itself.

```rust
let adults = db.select(users).filter(users.age.gte(18)).cte("adults");

let rows: Vec<User> = db
    .from(&adults)
    .filter(adults.column(users.age).lt(65))
    .all()
    .await?;
```

```sql
WITH "adults" AS (
    SELECT "users"."id", ... FROM "users" WHERE ("users"."age" >= $1)
)
SELECT "adults"."id", ... FROM "adults" WHERE ("adults"."age" < $2)
```

The expression is defined exactly where it is used, so there is no second statement and no
name to keep in sync. Its parameters come first, in the order the clause renders, and the
statement's own follow — one statement, one round trip.

## Columns

A table handle gets one field per column from `#[derive(Table)]`, because a table's columns
are known when the program is compiled. An expression's name is chosen at the call site, so
there is nothing for the derive to expand. `cte.column(..)` supplies the missing half: it
takes the column handle of the table the expression selects from and returns the same column
qualified by the expression's name.

```rust
adults.column(users.age)     // "adults"."age", typed as the same i32
adults.column(users.bio)     // "adults"."bio", still Option<String>
```

The Rust type, the SQL type and the nullability are the ones the schema declares, and the
expression must be in the query's row set for the call to compile — using a handle the
statement never defined or joined is a compile error.

Two expressions over the same table are the same Rust type, so the compiler cannot tell them
apart. The check is "this kind of expression is in scope", not "this exact one"; a mistake
there is a database error rather than a compile error. For the same reason a statement can
reference two expressions over two different tables but not two over the same one — the row
set would not say which is meant, exactly as it cannot for two joins of one table.

## Joining one

```rust
let recent = db
    .select(users)
    .filter(users.age.gte(18))
    .cte("recent");

let rows: Vec<(String, i64)> = db
    .select(posts)
    .inner_join_cte(&recent, recent.column(users.id).eq(posts.author_id))
    .pick((posts.title, count_all()))
    .group_by(posts.title)
    .await?;
```

`inner_join_cte` and `left_join_cte` are the join forms; a left join widens the row type to
`Option<T>` exactly as it does for a table. Joining attaches the definition to the statement,
so the `WITH` clause appears without a separate call.

## Using one in a subquery

A statement can define an expression it only mentions inside a subquery with `with_cte`:

```rust
let adults = db.select(users).filter(users.age.gte(18)).cte("adults");

db.select(posts)
    .with_cte(&adults)
    .filter(exists(
        db.from(&adults)
            .correlate(posts)
            .filter(adults.column(users.id).eq(posts.author_id)),
    ))
    .all()
    .await?;
```

The method is `with_cte` rather than `with`, because `Select::with` already means eager
loading a relation.

## Recursive expressions

`WITH RECURSIVE` needs the handle to be readable inside its own definition. `Cte::union_all`
takes the recursive term and builds the definition out of the anchor and that term:

```rust
let tree = db
    .select(nodes)
    .filter(nodes.parent_id.is_null())
    .cte("tree");

let rows: Vec<Node> = tree
    .clone()
    .union_all(
        db.select(nodes)
            .inner_join_cte(&tree, nodes.parent_id.eq(tree.column(nodes.id)))
            .pick(nodes),
    )
    .order_by(nodes.id.asc())
    .all()
    .await?;
```

```sql
WITH RECURSIVE "tree" AS (
    SELECT "nodes"."id", "nodes"."parent_id", "nodes"."name"
      FROM "nodes" WHERE ("nodes"."parent_id" IS NULL)
    UNION ALL
    SELECT "nodes"."id", "nodes"."parent_id", "nodes"."name"
      FROM "nodes" INNER JOIN "tree" ON ("nodes"."parent_id" = "tree"."id")
)
SELECT "tree"."id", "tree"."parent_id", "tree"."name" FROM "tree" ORDER BY "tree"."id" ASC
```

The statement reads the name back out, so `all()` decodes `Node` rather than a union of the
two branches. `.pick(nodes)` on the recursive term is what keeps the branch's row type the
same as the anchor's: a join widens the projection to both sides, and a union requires every
branch to produce the same columns.

`clone()` is needed only because one handle is used twice in one statement; the handle is a
value, not a borrow.

## What is checked

- A query that names an expression has to be a whole-row `SELECT` over one table. That is
  what lets the handle know its columns, and therefore what makes `cte.column(..)` typed. A
  projected query needs a different shape of handle, which does not exist yet.
- Every branch of a recursive definition must select the same number of columns; the builder
  checks before sending.
- A reference to an expression that is not in the row set does not compile.

## Gotchas

- **The name is written into the SQL, not bound.** It is a `&'static str`, so it is a literal
  at the call site; never build one from user input.
- **A name is not prefixed.** `Database::prefixed` rewrites table names in built statements;
  an expression's name is not a table and is left alone, which is what makes it work under a
  prefix.
- **An expression's name is scoped to its statement.** Two statements that both use
  `"adults"` each define their own; there is nothing shared to get out of step.
- **The recursion limit is the database's.** SQLite, PostgreSQL and MySQL each have their own
  behaviour for a runaway recursive term; Besu adds no guard. MySQL stops at
  `cte_max_recursion_depth` (1000 by default).
