---
title: "Integrations and non-goals"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/non-goals.md"
---

`gurafi` covers the schema-building and execution layer. Some Pothos plugins are integrations
with a particular JavaScript ecosystem; in Rust the same outcome is usually a normal crate or a
small amount of application code. This page records the intentional boundaries so the absence of
a plugin is a design decision, not an undocumented gap.

## Federation

There is no `_entities` resolver or subgraph protocol. Use `gql::Schema::merge`,
`extend_sdl` and public/internal schema variants when one process owns several modules. Split
independent services behind separate endpoints and compose at the gateway or BFF layer.

See [Add GraphQL and schema composition](../plugins/add-graphql).

## Prisma, Drizzle and database clients

These are JavaScript ORM integrations. In Rust, call the database from a resolver or a service,
and put batching in a `Loader` on the request context:

```rust
q.field_result_async("user", |args: UserArgs, ctx: &Ctx| {
    Box::pin(async move { ctx.database.user(&args.id).await })
});
```

See [Dataloaders](../plugins/dataloader) and [Context](context).

## Zod and runtime schema validation

Derive `Input` with `#[graphql(validate = "path")]`, use `ScalarValue::from_value` for a scalar,
or call `FieldConfig::validate` when the rule needs request state. The generated GraphQL schema
is already validated at build time.

See [Validation](../plugins/validation).

## With-Input

A field can return a struct or enum that wraps its arguments and result. Build a normal object
for the wrapper and construct it in the resolver. There is no separate input-echo plugin.

## Smart subscriptions

A subscription returns any `futures::Stream`. Topics, filtering and backpressure belong to the
stream implementation (`tokio::sync::broadcast`, `futures::channel`, `async-broadcast`, …), not
to the schema.

See [Subscriptions](operations#subscriptions).

## Grafast and SubGraph

`gql` executes GraphQL directly. There is no planning DSL to translate. Complexity and depth
checks run before execution; prepared queries cache static analysis.

## Prisma Next and other experimental Pothos features

Not part of the stable GraphQL contract. If an application needs one, place it in an application
crate rather than in the core builder.

## What to do when a plugin is missing

1. Check whether the behaviour belongs in a resolver, a `Loader`, a plugin (`Plugin<Ctx>`) or the
   transport.
2. Prefer a normal Rust crate over a schema feature when the concern is infrastructure.
3. If it is a cross-cutting field policy, [write a plugin](writing-plugins).
4. If it changes the schema shape, use [composition and transforms](printing-schemas).

## Next

- [Using plugins](using-plugins)
- [Writing plugins](writing-plugins)
- [Architecture](../architecture)
