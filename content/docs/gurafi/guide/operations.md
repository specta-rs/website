---
title: "Queries, mutations and subscriptions"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/operations.md"
---

The three root operation types are normal object types with fields. `gurafi` installs a root type
when it has at least one field, so declaring an otherwise empty mutation root does not appear in
the schema.

## Queries

```rust
schema.query(|q| {
    q.field("giraffe", |_: NoArgs, _: &Ctx| current_giraffe());
    q.field("giraffes", |args: ListArgs, ctx: &Ctx| list_giraffes(args, ctx));
});
```

`query` appends, so a query root can be declared across several modules. `query_fields` is the
same method with a name that states the intent.

## Mutations

```rust
schema.mutation(|m| {
    m.field_result("createGiraffe", |args: CreateArgs, ctx: &Ctx| {
        create_giraffe(args, ctx)
    });
    m.field_result("deleteGiraffe", |args: DeleteArgs, ctx: &Ctx| {
        delete_giraffe(args, ctx)
    });
});
```

Top-level mutation fields execute serially, as the GraphQL specification requires. Nested fields
may resolve concurrently unless the execution options disable concurrency.

## Subscriptions

A subscription field returns a stream. `gurafi` wraps each event as the subscription root value
and the executor re-executes the selection for every event.

```rust
use futures::stream::Stream;
use gurafi::{NoArgs, Schema};

schema.subscription(|s| {
    s.field("giraffeBorn", |_: NoArgs, ctx: &Ctx| {
        ctx.events.giraffe_births()
    });
});
```

The stream item is the field's value type. The `subscribe` closure receives the coerced
arguments and the context, and runs once when the subscription starts.

When the event is an envelope rather than the field value, use `field_map`:

```rust
#[derive(Clone)]
struct BornEvent {
    giraffe: Giraffe,
    zookeeper: String,
}

s.field_map::<NoArgs, BornEvent, Giraffe, _, _, _>(
    "giraffeBorn",
    |_: NoArgs, ctx: &Ctx| ctx.events.births(),
    |event: &BornEvent, _: NoArgs, _: &Ctx| Ok(event.giraffe.clone()),
);
```

The stream yields `Result<E, GraphQLError>`. An `Err` event becomes a field error; a stream-level
failure ends the subscription. Use `field_with_info` when `subscribe` needs `ResolveInfo`; each
event resolver can also receive `ResolveInfo` with the corresponding `*_with_info` variant.

A subscription must select exactly one root field, and that field must define a `subscribe`
resolver. Setup validates arguments once; every event reuses the coerced arguments and runs the
field validator once per event.

### Topics and filtering

There is no topic plugin: a subscription returns any `Stream`. A common pattern is a
`tokio::sync::broadcast::Receiver` wrapped with `tokio_stream::wrappers::BroadcastStream`, or a
`futures::channel` receiver filtered with `.filter(...)`. The stream type already carries the
filtering and fan-out behaviour, so the schema does not need a separate topic registry.

```rust
s.field("giraffeBorn", |_: NoArgs, ctx: &Ctx| {
    BroadcastStream::new(ctx.events.subscribe())
        .filter_map(|event| async move {
            event.ok().map(|event| Ok(event.giraffe))
        })
});
```

## Root type names

```rust
let mut schema = Schema::<Ctx>::new();
schema.query_name("RootQuery");
schema.mutation_name("RootMutation");
schema.subscription_name("RootSubscription");
```

The defaults are `Query`, `Mutation` and `Subscription`. Custom names appear in SDL and
introspection.

## Field order and descriptions

Fields are emitted in declaration order. Use `BuildOptions::sort_types(true)` when stable
alphabetical type ordering matters for diffs or generated clients. Root descriptions are set with
`BuildOptions::query_description`, `mutation_description` and `subscription_description`.

## Execution options

`gql::ExecutionOptions` controls the engine, not the schema:

```rust
let options = gql::ExecutionOptions {
    max_depth: 15,
    max_complexity: 1_000,
    ..gql::ExecutionOptions::with_context(MyContext { /* ... */ })
};
```

`suku` exposes the same limits on `Server`. See [Complexity](../plugins/complexity) and
[Serving over HTTP](../server/suku).

## Introspection

The schema supports the standard `__schema`, `__type` and `__typename` fields. Use
`schema.sdl()` to print the schema definition language document, or let a client run an
introspection query through `suku`.

## Next

- [Interfaces](interfaces)
- [Unions](unions)
- [Relay](../plugins/relay)
