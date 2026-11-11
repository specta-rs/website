---
title: "Complexity"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/complexity.md"
---

Complexity limits reject expensive operations before resolvers run. Each field has a static cost
of `1` unless it supplies an estimate; the executor multiplies nested costs and applies list
factors, depth and breadth limits.

## Field estimates

```rust
schema.object::<User>(|o| {
    o.field("posts", |u: &User, args: PostArgs, ctx: &Ctx| {
        load_posts(u, args, ctx)
    })
    .complexity(5);
});
```

A fixed estimate is useful when the field's cost is dominated by a known query. For an estimate
that depends on arguments, use `complexity_with`:

```rust
o.field("search", |_: &User, args: SearchArgs, ctx: &Ctx| search(args, ctx))
    .complexity_with(|args: &gql::Object| {
        let first = match args.get("first") {
            Some(gql::Value::Int(value)) => u32::try_from(*value).unwrap_or(10),
            Some(gql::Value::BigInt(value)) => u32::try_from(**value).unwrap_or(10),
            _ => 10,
        };
        first.saturating_mul(2)
    });
```

The estimator receives the coerced arguments as a `gql::Object`. It runs during analysis, before
the resolver. Keep it cheap and deterministic.

## Configure limits

On the engine:

```rust
let options = gql::ExecutionOptions {
    max_depth: 15,
    max_complexity: 1_000,
    max_breadth: 100,
    ..gql::ExecutionOptions::default()
};
```

On `suku`:

```rust
let server = suku::Server::new(schema)
    .max_depth(15)
    .max_complexity(1_000)
    .max_breadth(100)
    .max_errors(50);
```

The engine computes a static upper bound from the document, fragments and variables. A request
over the limit returns a request error and does not execute.

## List factor

`ExecutionOptions::list_complexity` controls how list cardinality is estimated. A higher factor
makes a field that returns a list more expensive; the default is conservative. Set it to match
the expected page size of your API.

## Prepared queries

Prepared queries cache their static complexity bound. A server can reject a prepared operation
once at registration and reuse the decision. `suku` does this for persisted operations.

## Introspection and meta fields

Introspection fields have their own cost and are included in the analysis. A schema with
introspection disabled should also reject introspection in production, not only hide the UI.

## Testing

Use a small limit in tests to assert the error path:

```rust
let options = gql::ExecutionOptions {
    max_complexity: 1,
    ..gql::ExecutionOptions::default()
};
let response = gql::execute(&schema, request, &options).await;
assert!(!response.errors.is_empty());
```

## Next

- [Tracing](tracing)
- [Serving over HTTP](../server/suku)
- [Troubleshooting](../guide/troubleshooting)
