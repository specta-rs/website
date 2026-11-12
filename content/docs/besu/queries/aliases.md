---
title: "Aliases"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/aliases.md"
---

`alias(table, "name")` gives a table a second name inside one statement. The reason to want
one is the self-join: "employees and their managers" reads the same table twice, and the two
occurrences need different names in the SQL.

```rust
#[derive(Table)]
#[besu(table = "employees")]
pub struct Employee {
    #[besu(primary_key)] pub id: i64,
    pub name: String,
    pub manager_id: Option<i64>,
}

let manager = alias(employees, "manager");
let pairs: Vec<(Employee, Option<Employee>)> = db
    .select(employees)
    .left_join(&manager, manager.column(employees.id).eq(employees.manager_id))
    .all()
    .await?;
```

```sql
SELECT "employees"."id", "employees"."name", "employees"."manager_id",
       "manager"."id", "manager"."name", "manager"."manager_id"
FROM "employees"
LEFT JOIN "employees" AS "manager" ON ("manager"."id" = "employees"."manager_id")
```

## Reading from an alias

An alias is a `TableRef`, so it is a source as well as a join target:

```rust
let manager = alias(employees, "manager");
let everyone: Vec<Employee> = db.select(&manager).all().await?;
```

```sql
SELECT "manager"."id", "manager"."name", "manager"."manager_id"
FROM "employees" AS "manager"
```

`db.select(&manager)` yields `Employee`, because an alias renames a table rather than
projecting a new shape, so the default projection is the table's own columns in the same
order.

## Columns

`#[derive(Table)]` gives a table handle one field per column, but it can only do that for a
name known at compile time. A derived table solves the same problem with
[`Derived::column`], and an alias solves it the same way:

```rust
manager.column(employees.email)      // "manager"."email"
manager.column(employees.manager_id) // "manager"."manager_id"
```

The argument is the base table's column handle, so the Rust type and the SQL type are the
ones the schema declares and a column of another table is rejected. The result is an
expression, qualified by the alias; it can be compared, filtered, ordered, grouped and
projected like any other expression.

The row set carries `Alias<Employee>` rather than `Employee`, so `manager.column(...)` only
compiles in a query that actually joined the alias — and `employees.email` and
`manager.column(employees.email)` are different columns even though they are one column of
one table.

## One alias per table

Two aliases of the *same* table in one statement do not compile. Both `alias(employees,
"manager")` and `alias(employees, "boss")` are `Alias<Employee>`, so the row set cannot tell
them apart: when both are joined, `manager.column(...)` finds two matching paths and the
compiler reports `E0283: type annotations needed` instead of choosing one.

That is a limit of the type, not of the SQL. The fix is a second type parameter carrying the
name — `Alias<T, Name>` — with a phantom tag, so `Alias<Employee, Manager>` and
`Alias<Employee, Boss>` are different types and each can be found at exactly one path. The
call site would name the tag, as in `alias_as::<Employee, Manager>(employees, "manager")`.
Nothing else in the query layer would change: `TableRef::Marker` is already the alias type,
and `Contains` already searches by type. The function `alias` cannot supply a tag by itself,
which is why it is not part of this API yet.

Until then, the second name has to come from somewhere else:

- a different table or a view — `managers` over `employees` — which keeps the join typed but
  is a schema change;
- a [derived table](select) for the second side, which is typed and executes, but is a
  second query shape rather than the same table twice.

## Gotchas

- **The name is written into the SQL, not bound.** It is quoted, so it may be any identifier,
  but passing a value from another source would be an injection.
- **The name must be unique in the statement.** The builder does not rename colliding
  aliases, because silently changing a name would change which table a column reference
  meant.
- **An alias is read-only.** `insert`, `update` and `delete` take the declared table handle,
  which is the only thing that knows the physical name.
- **A prefix applies to the table, not the alias.** On a
  [`Database::prefixed`](../schema/schemas) database the statement reads
  `FROM "tenant_1_employees" AS "manager"` and refers to `"manager"."id"`, because the alias
  is a name in the statement rather than a table in the database.
- **A column used only in `order_by` or `group_by` may need its row set pinned.** Those
  builders do not tie the expression's row set to the query's, so
  `db.select(&manager).order_by(manager.column(users.id))` as the *first* mention of the
  alias is ambiguous. Using the expression in a `filter`, a `pick` or a join condition first
  — or binding it to a variable that is used there — resolves it. The same applies to
  [`Derived::column`] and [`Cte::column`].
- **`#[besu(table = "..")]` is not an alias.** It names the table the struct maps to; two
  structs cannot share one name and be told apart in a query.

[`Derived::column`]: select.md
[`Cte::column`]: ../advanced/ctes.md
