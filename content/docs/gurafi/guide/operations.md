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

### Transporting subscriptions

A subscription is transport-independent; `suku` offers two ways to deliver it:

- **SSE** — `POST` the operation with `Accept: text/event-stream`. Each event is `event: next`
  with a `data:` JSON payload, followed by `event: complete`. This works through ordinary HTTP
  proxies and CDNs and needs no upgrade.
- **WebSocket** — connect with the `graphql-transport-ws` subprotocol at the GraphQL path. Send
  `connection_init`, wait for `connection_ack`, then `subscribe` with an `id`; the server sends
  `next` per event and `complete` at the end. A client `complete` cancels the stream.

Use SSE when the client only needs a one-way stream and the deployment blocks upgrades. Use
WebSocket when many operations should share one connection, the client needs to cancel, or the
application already speaks the protocol. Both transports execute through the same `Server`, so
limits, prepared queries and error formatting are identical. Authentication for a WebSocket runs
once on the upgrade request; the connection then reuses that context.

```graphql
subscription GiraffeBorn {
  giraffeBorn { id name }
}
```

Over HTTP this is `POST` with `{ "query": "...", "variables": {} }` and
`Accept: text/event-stream`; over WebSocket it is the `payload` of a `subscribe` message. See
[Serving over HTTP](../server/suku#websocket-graphql-transport-ws).

## File uploads

GraphQL has no binary literal, so file inputs use the
[multipart request specification](https://github.com/jaydenseric/graphql-multipart-request-spec):
the operation's variables contain `null` where a file belongs, and the file travels in a separate
multipart part. The server substitutes the file back into the variables before execution.

Model the file as a custom `Upload` scalar. In raw `gql`, a scalar `parse_value` accepts the
external value and the resolver downcasts it:

```rust
use gql::{GraphQLError, ResolverContext, Upload, Value};

fn upload_scalar() -> gql::ScalarType {
    gql::ScalarType::new("Upload").parse_value(|value| {
        if value.as_external::<Upload>().is_some() {
            Ok(value.clone())
        } else {
            Err("Expected a multipart file upload".to_owned())
        }
    })
}

fn receive(context: &ResolverContext<'_>) -> Result<Value, GraphQLError> {
    let file = context
        .args
        .get("file")
        .and_then(Value::as_external::<Upload>)
        .ok_or_else(|| GraphQLError::new("Expected an upload"))?;
    // file.filename(), file.content_type(), file.bytes()
    Ok(Value::from(file.len() as i64))
}
```

In `gurafi`, use `Upload` directly in a derived args or input struct. It is an input-only
scalar and is registered automatically:

```rust
use gurafi::{Input, NoArgs, Upload};

#[derive(Input)]
struct UploadArgs {
    file: Upload,
}

schema.mutation(|m| {
    m.field_result("uploadAvatar", |args: UploadArgs, ctx: &Ctx| {
        store_avatar(&args.file, ctx)
    });
});
```

The resolver receives the file with `filename()`, `content_type()` and `bytes()`. A plain
non-`Option` field is declared `Upload!`; use `Option<Upload>` when the file is optional.
Direct output use is a compile error because a file has no GraphQL response representation.

A client sends:

```sh
curl http://localhost:3000/graphql \
  -F operations='{ "query": "mutation ($file: Upload!) { uploadAvatar(file: $file) }", "variables": { "file": null } }' \
  -F map='{ "0": ["variables.file"] }' \
  -F 0=@avatar.png
```

Files may be nested in input objects (`variables.input.avatar`) or lists
(`variables.files.0`), and a batch prefixes paths with the request index. Paths must point at an
existing `null` inside `variables`; a file cannot be injected anywhere else. See
[Serving over HTTP](../server/suku#multipart-uploads) for limits and error handling.

The transport buffers each request up to `max_body_bytes` (1 MiB by default). Raise it for real
uploads and set the reverse proxy to the same limit.

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
