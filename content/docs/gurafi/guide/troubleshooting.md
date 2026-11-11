---
title: "Troubleshooting"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/troubleshooting.md"
---

## Build errors

### "Object type `X` is used by a field but was never registered"

A resolver or argument references a type that has not been declared. Register it before
`build()`:

```rust
schema.object::<User>(|o| { /* ... */ });
```

Runtime-named types use `schema.object_ref::<User>("Name")`. Generated result-union payloads must
be registered like any object; the error names the missing payload and the field that needs it.

### "Object type `X` is registered by more than one Rust type"

Two different models claim the same GraphQL name. Rename one with
`#[graphql(name = "...")]`, or use `object_ref::<M>("Name")` for a deliberate runtime name.

### "Field `Type.field` inherits `T` from its interface, but its resolver returns `U`"

An interface field's type and arguments must match the implementation. Use
`resolve_inherited("field", ...)` to inherit the interface declaration, or make the resolver
return the same type.

### "Field ... declares its type as `T!`, which is not compatible with the resolver's Rust type"

A nullability override makes a nullable Rust position non-null, or changes a list shape without
changing the Rust type. Either change the resolver to return a non-optional value or keep the
override consistent. See [Nullability](nullability).

### "The query root type ... does not exist"

A schema must have at least one query field. Register `schema.query(|q| { ... })`.

## Runtime errors

### A field is unexpectedly null

Check the response `errors` array. A non-null child that fails or returns `null` propagates null
to the nearest nullable parent. If a resolver returns `None`, the field must be nullable in the
schema (`Option<T>`).

### "could not be serialized"

A resolver returned a value whose Rust type does not match the declared GraphQL type. This often
comes from `as_dynamic`/`field_ref_type` declaring a scalar while returning a model. The named
type is checked at build time, but the runtime value must still match it.

### "Invalid arguments for ..."

Argument coercion or `validate` rejected client input. The error is a client error and carries
`BAD_USER_INPUT`; a server-side `mask_internal` keeps it visible.

### "Sign in" / "Not authorized"

A field, object or interface `.auth(...)` rule denied the request. Check the context extractor
and the rule's scope. Field auth is skipped by a mock plugin that replaces the resolver; object
and interface auth is not.

## Resolver panics

A panic inside a resolver is caught at the resolver boundary. It cannot unwind the request,
abort the process, or end a subscription stream. Instead it becomes a normal field error:

```json
{
  "message": "Internal server error",
  "locations": [{ "line": 1, "column": 3 }],
  "path": ["field"],
  "extensions": { "code": "INTERNAL_SERVER_ERROR" }
}
```

This covers field resolvers (object, root, list item, abstract typed fields), subscription setup
resolvers, every per-event subscription resolver, `resolve_type` and `is_type_of`. Sibling fields
still complete, and null propagation follows the field's declared nullability exactly as it does
for a resolver that returns `Err`. If a subscription setup resolver panics, `subscribe` returns
an error response; if a per-event resolver panics, that event produces an error response and the
remaining events keep flowing.

The panic payload and backtrace are never included in the response. The process-wide panic hook
still runs, so your logging or crash reporter sees the original panic; fix the resolver rather
than relying on the fallback error.

`mask_internal` leaves the error untouched because it carries a code, so clients can branch on
`INTERNAL_SERVER_ERROR` instead of treating it as a generic masked failure.

Isolation uses `std::panic::catch_unwind` and therefore only works while the binary unwinds. A
release profile with `panic = "abort"` aborts the process on the first panic before the engine can
catch it. Keep the default unwind strategy if resolver panics must be contained.

## Deep queries

`gql` enforces parser depth and execution depth limits. Configure them on `suku`:

```rust
let server = suku::Server::new(schema)
    .max_depth(15)
    .max_complexity(1_000);
```

The engine returns a request error rather than overflowing the stack. A recursive schema is fine;
the limit applies to document depth, not to the type graph.

## Slow requests and N+1 queries

Use tracing and loaders:

1. Enable the `tracing` feature and run with `RUST_LOG=gql=debug,gurafi=debug`.
2. Look for repeated identical loader work or one database call per list item.
3. Put a `Loader` in the request context and load by key.
4. Return a page of data from the parent resolver when the child list is known there; the
   executor completes list items sequentially, so `load_many` is the explicit batching point.

See [Dataloaders](../plugins/dataloader), [Complexity](../plugins/complexity) and
[Tracing](../plugins/tracing).

## Subscriptions

A subscription field must define a `subscribe` resolver and select exactly one root field. The
setup resolver runs once; each event re-executes the selection with the event as the root value.
If an event's type does not match the field's stream item, the field returns an error rather than
panicking.

For a multi-field event, use `field_map` instead of `field`.

## Testing

Build a schema per test and execute directly:

```rust
#[tokio::test]
async fn giraffe_has_a_name() {
    let schema = schema();
    let response = gql::execute(
        &schema,
        gql::Request::new("{ giraffe { name } }"),
        &gql::ExecutionOptions::default(),
    )
    .await;

    assert!(response.errors.is_empty(), "{:?}", response.errors);
}
```

Keep snapshot tests for SDL:

```rust
insta::assert_snapshot!(schema.sdl());
```

`gql::diff` catches accidental breaking changes in CI.

## Logging and tracing

`gql`, `gurafi`, `gurafi-relay` and `suku` have an optional `tracing` feature. Without it, no
`tracing` code is compiled into those crates. See [Tracing](../plugins/tracing).

## Next

- [Getting started](getting-started)
- [Printing schemas](printing-schemas)
- [Serving over HTTP](../server/suku)
