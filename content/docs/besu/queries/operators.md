---
title: "Operators"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/queries/operators.md"
---

Every operator is a typed expression: it knows the SQL type it compares and the tables it may
reference. Comparisons exist both as methods on a column and as free functions in the prelude;
the rendered SQL is the same. Examples render for SQLite, where parameters are `?`; PostgreSQL
numbers them `$1`, `$2`.

## Comparison

| SQL | Column method | Free function |
| --- | --- | --- |
| `=` | `users.age.eq(18)` | `eq(users.age, 18)` |
| `<>` | `users.age.ne(18)` | `ne(users.age, 18)` |
| `>` | `users.age.gt(18)` | `gt(users.age, 18)` |
| `>=` | `users.age.gte(18)` | `gte(users.age, 18)` |
| `<` | `users.age.lt(18)` | `lt(users.age, 18)` |
| `<=` | `users.age.lte(18)` | `lte(users.age, 18)` |

```rust
db.select(users)
    .filter(users.age.gte(18))
    .filter(users.age.lt(65))
    .await?;
```

```sql
SELECT ... FROM "users" WHERE ("users"."age" >= ?) AND ("users"."age" < ?)
```

The free form checks both operands, so `eq(users.id, 1_i64)` and `eq(7, users.age)` compile while
`eq(users.id, "seven")` does not. The column form checks its argument against the column's type.
The same methods exist on `Expr`, which is how an aggregate gets compared:
`count_all().gt(1)`.

## Logical

`and`, `or` and `not` take anything usable as a condition, including a boolean column on its own.

```rust
db.select(users)
    .filter(and(
        users.age.gte(18),
        or(users.bio.is_not_null(), not(users.name.eq("Anonymous"))),
    ))
    .await?;
```

```sql
SELECT ... FROM "users"
WHERE (("users"."age" >= ?) AND (("users"."bio" IS NOT NULL) OR (NOT ("users"."name" = ?))))
```

A boolean column needs no comparison, so for a table with an `active: bool` column,
`filter(users.active)` renders `WHERE "users"."active"`, without parentheses.

## Null and boolean tests

`is_null` and `is_not_null` are column methods and functions. `is_true` and `is_false` are
functions only, and take any typed expression — a boolean column such as `active` included.

```rust
db.select(users)
    .filter(users.bio.is_null())
    .filter(is_true(users.active))
    .await?;
```

```sql
SELECT ... FROM "users" WHERE ("users"."bio" IS NULL) AND ("users"."active" IS TRUE)
```

These are `IS` tests rather than `= TRUE`, so a `NULL` column is neither true nor false, as SQL
intends.

## Pattern matching

`like`, `not_like`, `ilike` and `not_ilike` exist as a column method
(`users.name.like("A%")`) and as a function (`like(users.name, "A%")`).

```rust
db.select(users).filter(users.name.like("A%")).await?;
```

```sql
SELECT ... FROM "users" WHERE ("users"."name" LIKE ?)
```

The pattern is bound as a parameter, so `%` and `_` are SQL wildcards without any string
interpolation. `ILIKE` is PostgreSQL-only: elsewhere the statement builds and records
``unsupported: `sqlite` has no `ILIKE`; use `LIKE` with a lowercased column instead``.

## Null-safe comparison

`=` and `<>` are `UNKNOWN` when either side is `NULL`, so a comparison against a nullable
column silently matches nothing. `IS DISTINCT FROM` treats `NULL` as a value.

```rust
db.select(users).filter(users.bio.is_distinct_from("hello")).await?;
db.select(users).filter(users.bio.is_not_distinct_from(Option::<String>::None)).await?;
```

```sql
-- PostgreSQL and SQLite
SELECT ... FROM "users" WHERE ("users"."bio" IS DISTINCT FROM $1)
SELECT ... FROM "users" WHERE ("users"."bio" IS NOT DISTINCT FROM $1)
```

```sql
-- MySQL, where `<=>` is null-safe equality
SELECT ... FROM `users` WHERE (NOT (`users`.`bio` <=> ?))
SELECT ... FROM `users` WHERE (`users`.`bio` <=> ?)
```

`is_distinct_from`, `is_not_distinct_from` exist both as column methods and as free
functions. The two sides must have the same SQL type, exactly as `eq` requires.

## Regular expressions

`regex_match`, `regex_match_ci`, `not_regex_match` and `not_regex_match_ci` are the four
forms: match or no match, case sensitive or not. The pattern is a bound parameter.

```rust
db.select(users).filter(users.name.regex_match_ci("^o")).await?;
```

```sql
-- PostgreSQL
SELECT ... FROM "users" WHERE ("users"."name" ~* $1)
-- MySQL
SELECT ... FROM `users` WHERE (REGEXP_LIKE(`users`.`name`, ?, 'i'))
```

| Form | PostgreSQL | MySQL | SQLite |
| --- | --- | --- | --- |
| case-sensitive match | `a ~ b` | `a REGEXP b` | unsupported |
| case-insensitive match | `a ~* b` | `REGEXP_LIKE(a, b, 'i')` | unsupported |
| negated match | `a !~ b` | `NOT (a REGEXP b)` | unsupported |
| negated, case-insensitive | `a !~* b` | `NOT REGEXP_LIKE(a, b, 'i')` | unsupported |

SQLite has no regular-expression support unless an extension is loaded, so a regex there
records `Error::unsupported` instead of emitting PostgreSQL's operator. MySQL's `REGEXP`
follows the column's collation: under the default `utf8mb4_unicode_ci`, even the nominally
case-sensitive form is case-insensitive.

## Ranges

```rust
db.select(users).filter(users.age.between(18, 65)).await?;
db.select(users).filter(not_between(users.age, 18, 65)).await?;
```

```sql
SELECT ... FROM "users" WHERE ("users"."age" BETWEEN ? AND ?)
SELECT ... FROM "users" WHERE ("users"."age" NOT BETWEEN ? AND ?)
```

`between` is a column method and a function; `not_between` is a function only. Both bounds are
inclusive, as in SQL.

## Sets

```rust
db.select(users).filter(users.name.in_list(["Alice", "Bob"])).await?;
db.select(users).filter(users.name.not_in(["Alice"])).await?;
```

```sql
-- SQLite and MySQL
SELECT ... FROM "users" WHERE ("users"."name" IN (?, ?))
SELECT ... FROM "users" WHERE ("users"."name" NOT IN (?))

-- PostgreSQL
SELECT ... FROM "users" WHERE ("users"."name" = ANY($1))
SELECT ... FROM "users" WHERE ("users"."name" <> ALL($1))
```

On PostgreSQL the whole list is one bound array parameter, so a large list is limited by the
array size rather than by the 65,535-parameter limit. Every other dialect binds one parameter
per item. An empty list is not valid SQL — `IN ()` is a syntax error everywhere — so it renders
the constant predicate `(1 = 0)` for `in_list` and `(1 = 1)` for `not_in`, which the database
folds away and which keeps a dynamically built filter from producing broken SQL.

The items are checked against the column's SQL type, so `users.age.in_list(["Alice"])` is a
compile error rather than a runtime one. For a subquery, `in_query` and `not_in_query` take a
`select` instead of a list.

## Arithmetic

`plus`, `minus`, `times`, `divide` and `modulo` cover `+`, `-`, `*`, `/` and `%`.

```rust
db.select(users).pick(users.age.as_expr().plus(1)).await?;
```

```sql
SELECT ("users"."age" + ?) FROM "users"
```

The five methods exist on a column as well as on `Expr`, so `users.age.plus(1)` is the same
expression. The result keeps the column's SQL type: an `i32` column stays `i32`.

## Conditional

`case` builds `CASE WHEN ... THEN ... ELSE ... END`. The result type is a type parameter, because
a bare literal could be `TEXT`, `VARCHAR(n)` or `CHAR(n)`.

```rust
db.select(users)
    .pick(case::<_, besu::Text>()
        .when(users.age.gte(18), "adult")
        .otherwise("minor"))
    .await?;
```

```sql
SELECT (CASE WHEN ("users"."age" >= ?) THEN ? ELSE ? END) FROM "users"
```

`coalesce` falls back when the first expression is `NULL`, and `cast` changes the SQL type:

```rust
db.select(users)
    .pick((
        coalesce(users.bio.as_expr(), "none"),
        users.age.as_expr().cast::<besu::Text>(),
    ))
    .await?;
```

```sql
SELECT COALESCE("users"."bio", ?), CAST("users"."age" AS TEXT) FROM "users"
```

`COALESCE` is also a column method, `users.bio.coalesce("none")`. `CAST` is a method on `Expr`
only; the target is a `SqlType` such as `besu::Text`, `besu::Int8` or `besu::Float8`.

The type named in a cast is not always the type named in DDL: MySQL's `CAST` accepts `SIGNED`,
`CHAR`, `DOUBLE`, `BINARY`, `DATETIME`, `DECIMAL(p,s)` and a few others, but not `INTEGER`,
`TEXT` or `VARCHAR(n)`. The dialect renders the cast spelling itself, so `cast::<besu::Int8>()`
becomes `CAST(... AS SIGNED)` on MySQL and `CAST(... AS BIGINT)` on PostgreSQL. A custom type is
passed through verbatim, because only you know what the server accepts for it.

## Functions and aggregates

```rust
db.select(users)
    .pick((
        concat(users.name.as_expr(), users.email.as_expr()),
        count_all(),
        count_distinct(users.age),
        sum(users.age),
        avg(users.age),
    ))
    .await?;
```

```sql
SELECT CONCAT("users"."name", "users"."email"), COUNT(*), COUNT(DISTINCT "users"."age"),
       CAST(SUM("users"."age") AS REAL), CAST(AVG("users"."age") AS REAL) FROM "users"
```

`concat` takes two to eight arguments and every one may be a literal, so
`concat(users.first, " ")` compiles; Rust has no variadic functions, so the wider forms are
`concat3` to `concat8`, and `concat_ws` joins with a separator.

MySQL's `CONCAT` returns `NULL` when any argument is `NULL`, while PostgreSQL and SQLite skip
the missing ones. `concat_ws` skips `NULL` arguments on all three, which makes it the
portable choice when a column may be missing.

`lower`, `upper`, `length`, `trim`, `abs`, `round`, `ceil`, `floor`, `min` and `max` are the
rest; `min` and `max` keep the argument's type. `sum`, `avg`, `stddev` and `variance` are
widened to `f64` and cast in the database (`REAL` on SQLite, `DOUBLE PRECISION` on
PostgreSQL), because a sum of integers can overflow and PostgreSQL and MySQL return `NUMERIC`
for an aggregate. `count(expr)` counts non-`NULL`.

### The whole function surface

Every helper names one canonical function and the dialect decides what reaches the server. A
function the dialect has no spelling for records `Error::unsupported`; it never emits another
database's syntax.

| Family | Helpers |
| --- | --- |
| Strings | `char_length`, `octet_length`, `length`, `lower`, `upper`, `trim`, `ltrim`, `rtrim`, `btrim`, `initcap`, `reverse`, `substr`, `substring`, `replace`, `left`, `right`, `lpad`, `rpad`, `repeat`, `strpos`, `split_part`, `translate`, `concat`, `concat3`–`concat8`, `concat_ws`, `md5`, `sha256`, `to_base64`, `from_base64`, `regexp_replace`, `regexp_substr`, `date_format` |
| Numbers | `abs`, `round`, `round_to`, `ceil`, `floor`, `trunc`, `sign`, `sqrt`, `power`, `exp`, `ln`, `log10`, `log`, `nullif`, `greatest`, `least`, `coalesce`, `coalesce3`–`coalesce5` |
| Dates | `current_date`, `now`, `date_trunc`, `extract`, `datediff`, `date_add`, `date_sub`, `unix_timestamp`, `from_unixtime` |
| Aggregates | `count`, `count_all`, `count_distinct`, `sum`, `avg`, `min`, `max`, `string_agg`, `bool_and`, `bool_or`, `every`, `stddev`, `stddev_pop`, `variance`, `var_pop`, `json_agg`, `jsonb_agg`, `json_object` |
| Windows | `row_number`, `rank`, `dense_rank`, `lag`, `lag_by`, `lead`, `lead_by` |

Which of them a database actually has is in the table below. A blank cell is a function the
database does not have, and using it records `unsupported`.

| Helper | PostgreSQL | MySQL 8.4 | SQLite |
| --- | --- | --- | --- |
| `char_length` | `CHAR_LENGTH` | `CHAR_LENGTH` | `LENGTH` |
| `octet_length` | `OCTET_LENGTH` | `LENGTH` | — |
| `initcap` | `INITCAP` | — | — |
| `reverse` | `REVERSE` | `REVERSE` | — |
| `left`, `right` | `LEFT`, `RIGHT` | `LEFT`, `RIGHT` | — |
| `lpad`, `rpad` | `LPAD`, `RPAD` | `LPAD`, `RPAD` | — |
| `btrim` | `BTRIM` | `TRIM` | `TRIM` |
| `strpos` | `STRPOS` | `INSTR` | `INSTR` |
| `split_part` | `SPLIT_PART` | — | — |
| `translate` | `TRANSLATE` | — | — |
| `concat`, `concat_ws` | `CONCAT`, `CONCAT_WS` | `CONCAT`, `CONCAT_WS` | `CONCAT`, `CONCAT_WS` |
| `md5` | `MD5` | `MD5` | — |
| `sha256` | — | `SHA2(x, 256)` | — |
| `to_base64`, `from_base64` | — | `TO_BASE64`, `FROM_BASE64` | — |
| `regexp_replace` | `REGEXP_REPLACE` | `REGEXP_REPLACE` | — |
| `regexp_substr` | — | `REGEXP_SUBSTR` | — |
| `date_format` | — | `DATE_FORMAT` | — |
| `date_trunc` | `DATE_TRUNC` | — | — |
| `extract` | `EXTRACT(.. FROM ..)` | `EXTRACT(.. FROM ..)` / `WEEK(x, 3)` | `strftime` |
| `datediff` | date subtraction | `DATEDIFF` | `julianday` |
| `date_add`, `date_sub` | `make_interval` | `DATE_ADD`/`DATE_SUB` | `date`/`datetime` |
| `unix_timestamp`, `from_unixtime` | — | `UNIX_TIMESTAMP`, `FROM_UNIXTIME` | — |
| `string_agg` | `STRING_AGG` | `GROUP_CONCAT(x SEPARATOR y)` | `GROUP_CONCAT` |
| `bool_and`, `bool_or` | `BOOL_AND`, `BOOL_OR` | `MIN`, `MAX` | `MIN`, `MAX` |
| `stddev`, `variance` | `STDDEV`, `VARIANCE` | `STDDEV_SAMP`, `VAR_SAMP` | — |
| `json_agg` | `JSON_AGG` | `JSON_ARRAYAGG` | `JSON_GROUP_ARRAY` |
| `jsonb_agg` | `JSONB_AGG` | `JSON_ARRAYAGG` | `JSON_GROUP_ARRAY` |
| `json_object` | `JSONB_BUILD_OBJECT` | `JSON_OBJECT` | `JSON_OBJECT` |
| `greatest`, `least` | `GREATEST`, `LEAST` | `GREATEST`, `LEAST` | `MAX`, `MIN` |
| `round_to` | `ROUND` | `ROUND` | `ROUND` |
| `ceil`, `floor` | `CEIL`, `FLOOR` | `CEIL`, `FLOOR` | — |
| `trunc` | `TRUNC` | `TRUNCATE(x, 0)` | — |
| `sign` | `SIGN` | `SIGN` | — |
| `log(base, value)` | `LN(value) / LN(base)`, on every dialect | | |

SQLite's mathematical functions — `sqrt`, `power`, `exp`, `ln`, `log10`, `sign`, `trunc`,
`ceil` and `floor` — need `SQLITE_ENABLE_MATH_FUNCTIONS`, which the amalgamation `sqlx`
builds does not set. They are unavailable there and record `unsupported`; `abs`, `round` and
`round_to` are part of SQLite's core and work.

`log(base, value)` is written as `LN(value) / LN(base)` rather than calling `LOG`, because
there is no portable spelling: PostgreSQL's two-argument `log` wants `numeric`, MySQL's
`LOG(b, x)` wants doubles, and the one-argument form means base 10 on PostgreSQL and the
natural logarithm on MySQL.

`round_to` returns a double on every dialect. PostgreSQL has no two-argument `round` over a
double, so the dialect casts the *argument* to `numeric` itself; the result is cast back to a
double so one Rust type decodes all three. For an exact decimal result, round a `Decimal`
column with a cast instead.

`sign` returns a whole number on every dialect, because MySQL's `SIGN` returns a `BIGINT`
whatever the argument is; the helpers cast it so one Rust type decodes all three. `trunc`
returns a double for the mirror-image reason.

### `FILTER`

`FILTER (WHERE ...)` restricts an aggregate to some of the rows without changing which rows
the rest of the `SELECT` sees.

```rust
db.select(orders)
    .pick((orders.customer_id, sum(orders.total).filter(orders.paid)))
    .group_by(orders.customer_id)
    .await?;
```

```sql
SELECT "orders"."customer_id",
       CAST((SUM("orders"."total") FILTER (WHERE "orders"."paid")) AS DOUBLE PRECISION)
FROM "orders" GROUP BY "orders"."customer_id"
```

PostgreSQL and SQLite have `FILTER`; MySQL does not, so it records `unsupported` with the
equivalent spelled out — a `case` expression inside the aggregate.

### Windows

`.over(Window::new()..)` turns any aggregate or window function into one that looks at a
window of rows rather than at the whole result.

```rust
db.select(users)
    .pick((
        users.name,
        row_number().over(
            Window::new()
                .partition_by(users.team)
                .order_by(users.age.asc())
                .rows_between(FrameBound::UnboundedPreceding, FrameBound::CurrentRow),
        ),
    ))
    .await?;
```

```sql
SELECT "users"."name", ROW_NUMBER() OVER (PARTITION BY "users"."team"
       ORDER BY "users"."age" ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
FROM "users"
```

`Window` takes `partition_by`, `order_by`, `rows_between`, `range_between` and `rows_from`;
`FrameBound` is `UnboundedPreceding`, `Preceding(n)`, `CurrentRow`, `Following(n)` or
`UnboundedFollowing`. A window with no frame uses the database's default, which is the whole
partition for an `ORDER BY`-less window and the rows up to the current one otherwise.


`now()` renders `CURRENT_TIMESTAMP`. `json_get` and `json_text` take a dotted key path into a
JSON column — here `events.payload` — and render `->` / `->>` (PostgreSQL `#>` / `#>>`);
`json_get` keeps the JSON type, so comparing needs `json_text`.

```rust
db.select(events)
    .pick((now(), json_get(events.payload, "kind")))
    .filter(json_text(events.payload, "kind").eq("signup"))
    .await?;
```

```sql
SELECT CURRENT_TIMESTAMP, "events"."payload" -> '$.kind' FROM "events"
WHERE ("events"."payload" ->> '$.kind' = ?)
```

`matches` is a full-text search, spelled by the dialect: `to_tsvector(..) @@
plainto_tsquery(..)` on PostgreSQL, `MATCH(..) AGAINST (..)` on MySQL and `MATCH` on SQLite,
where the table has to be an FTS5 virtual table.

## Arrays

Only PostgreSQL has an array type. A `Vec<T>` field is inferred as `besu::Array<T>` and declared
as `<T>[]`; every helper below renders PostgreSQL's operator or function and records
`Error::unsupported` on MySQL and SQLite, which have no array type at all.

| SQL | Helper |
| --- | --- |
| `a @> b` | `array_contains(a, b)` |
| `a <@ b` | `array_contained_by(a, b)` |
| `a && b` | `array_overlaps(a, b)` |
| `a \|\| b` | `array_concat(a, b)` or `array_cat(a, b)` |
| `a[i]` | `array_get(a, i)` |
| `x = ANY(a)` | `in_list(x, values)` |
| `array_length(a, n)` | `array_length(a, n)` |
| `cardinality(a)` | `cardinality(a)` |
| `array_append(a, x)` | `array_append(a, x)` |
| `array_prepend(x, a)` | `array_prepend(x, a)` |
| `array_position(a, x)` | `array_position(a, x)` |
| `array_remove(a, x)` | `array_remove(a, x)` |
| `array_replace(a, x, y)` | `array_replace(a, from, to)` |
| `array_to_string(a, s)` | `array_to_string(a, separator)` |
| `string_to_array(s, d)` | `string_to_array(text, delimiter)` |
| `array_agg(x)` | `array_agg(x)` |

```rust
db.select(posts)
    .filter(array_contains(posts.tags, vec!["rust".to_owned()]))
    .await?;
```

```sql
SELECT ... FROM "posts" WHERE ("posts"."tags" @> $1)
```

A bound array carries its element's declared type, because PostgreSQL's binary array format
names the element OID in its header and the server rejects a mismatch. One consequence is that
`Vec<String>` is always bound as `TEXT[]`: a `VARCHAR(n)[]` column needs the typed expression
path rather than a whole-model insert.

Arrays decode one dimension into a `Vec`. A multi-dimensional array, or one containing a `NULL`
element, needs `sql!`: a `Vec<T>` has no room for either.

## JSON

`json_get(document, "a.b")` and `json_text(document, "a.b")` split a dotted string, which cannot
express a key containing a dot. `JsonPath` is the structured form and each dialect renders it in
its own grammar, escaping once:

```rust
use besu::expr::{JsonPath, json_at_text};

db.select(events)
    .pick(json_at_text(
        events.payload,
        JsonPath::root().key("user.name").index(0),
    ))
    .await?;
```

```sql
-- PostgreSQL: a text[] path, so the key with a dot is one element
SELECT ("events"."payload" #>> '{user.name,0}') FROM "events"

-- MySQL: a $.path, so the key is quoted
SELECT JSON_UNQUOTE(JSON_EXTRACT(`events`.`payload`, '$."user.name"[0]')) FROM "events"
```

`json_key` and `json_key_text` bind a key instead of writing it into the path, which is what to
use when the key comes from the caller.

| SQL | Helper | Dialects |
| --- | --- | --- |
| `a @> b` | `contains_json(a, b)` | PostgreSQL |
| `a <@ b` | `json_contained_by(a, b)` | PostgreSQL |
| `a ? key` | `json_has_key(a, key)` | PostgreSQL |
| `a ?\| keys` | `json_has_any(a, keys)` | PostgreSQL |
| `a ?& keys` | `json_has_all(a, keys)` | PostgreSQL |
| `a #- path` | `json_strip(a, path)` | PostgreSQL |
| `a @? predicate` | `json_matches_path(a, predicate)` | PostgreSQL |
| `a @@ predicate` | `json_matches(a, predicate)` | PostgreSQL |
| `JSON_CONTAINS(a, b)` | `contains_json(a, b)` | MySQL |
| `JSON_CONTAINS_PATH(a, ..)` | `json_has_key`, `json_has_any`, `json_has_all` | MySQL |
| `JSON_REMOVE(a, path)` | `json_strip`, `json_remove` | MySQL, SQLite |
| `JSON_SET(a, path, v)` | `json_set(a, path, value)` | MySQL, SQLite, PostgreSQL (`JSONB_SET`) |
| `JSON_VALUE(a, path)` | `json_value(a, path)` | MySQL |
| `JSON_QUERY(a, path)` | `json_query(a, path)` | MySQL |
| `JSON_MERGE_PATCH(a, b)` | `json_merge_patch(a, b)` | MySQL |
| `JSON_OVERLAPS(a, b)` | `json_overlaps(a, b)` | MySQL |
| `JSON_ARRAYAGG(x)` | `json_array_agg(x)` / `json_agg(x)` | MySQL |
| `JSON_OBJECTAGG(k, v)` | `json_object_agg(k, v)` | MySQL |

The `?`, `?|` and `?&` operators are written with `??`, `??|` and `??&` in `sql!`, which the
macro unescapes, so a raw fragment can use them too.

MySQL takes a JSON argument as a JSON *document* only when it is cast; the helpers cast their
parameters to `JSON`, so `json_set(doc, path, 4)` stores the number rather than the string
`"4"`.

## What is missing

- **`SIMILAR TO`** — reachable through `raw`, because no dialect here implements it and it is
  not the same thing as a regular expression.
- **`unnest` in `FROM`** — a set-returning function has no place in the typed query builder, so
  write it with `sql!`.
- **Multi-dimensional arrays** — only one dimension decodes into a `Vec`, and a `NULL` element
  has no representation in one.

## What is checked

| Mistake | When it fails |
| --- | --- |
| A literal or column of another SQL type | Compile error |
| A table that was not joined | Compile error |
| `ILIKE`, a regex or a function the dialect has no spelling for | Build error |
| Too many `IN` values for the dialect's parameter limit | Build error |

## Gotchas

- **`between` is not type-checked against the column.** It takes two values of one type, but
  not the column's type, so a mismatched pair fails in the database.
- **`not_between`, `is_true` and `is_false` are functions, not column methods.**
- **`concat` stops at eight arguments.** Rust has no variadic functions; nest a call or use
  `concat_ws` instead.
- **A function the dialect lacks is a build error, not a server error.** That is deliberate:
  the message names the helper and the dialect, where the server would only say "no such
  function".
- **`sum` and `avg` return `f64`.** Annotate `Vec<f64>` when you pick one. For an exact sum of a
  decimal column use `sum_as`/`avg_as` (or the `SumAs`/`AvgAs` methods), which do not cast
  through a double. `json_get` paths still use dots — a key containing one needs `JsonPath`.
