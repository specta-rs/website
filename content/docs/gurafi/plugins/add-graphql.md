---
title: "Add GraphQL and schema composition"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/add-graphql.md"
---

A schema is already a `gql::Schema`, so composition happens with `gql` directly: merge,
extend, filter and transform. There is no separate "add schema" step or generated wrapper.

## Add an SDL module

```rust
let schema = schema.extend_sdl(
    r#"
    extend type Query {
      health: String
    }

    type AuditEntry {
      id: ID!
      message: String!
    }
    "#,
)?;
```

`extend_sdl` prints the current schema, appends the extension, rebuilds and overlays the original
resolvers onto surviving fields. Use `extend_sdl_many` for a set of documents in one build:

```rust
let schema = schema.extend_sdl_many([
    include_str!("extensions/health.graphql"),
    include_str!("extensions/audit.graphql"),
])?;
```

Add resolvers for new fields by reopening the type in Rust:

```rust
schema.query(|q| {
    q.field("health", |_: NoArgs, _: &Ctx| "ok");
});
```

## Merge a schema

```rust
let merged = public.merge(&internal)?;
```

A duplicate type must be structurally identical. If both sides set different runtime
implementations for the same slot (resolver, subscribe, complexity, `is_type_of`,
`resolve_type`, scalar coercion), the merge fails instead of choosing by argument order.

Resolvers, object type checks and scalar coercion from either side are preserved. Directive
applications are compared without regard to order.

## Compose from SDL

```rust
let base = gql::Schema::from_sdl(include_str!("schema/base.graphql"))?;
let schema = base.merge(&Schema::from_sdl(include_str!("schema/extensions.graphql"))?)?;
```

`Schema::from_sdl` respects an explicit schema definition and infers default roots only when no
schema definition is present.

## Filter a schema

```rust
let public = schema.without_types(&["AuditEntry", "InternalFlag"])?;
let internal = schema.retain_types(|ty| ty.name().as_ref().starts_with("Internal"))?;
```

`retain_types` keeps introspection types and passes every user type to the predicate.
Removing a type that is still referenced is a validation error.

## Transform fields

```rust
use gql::FieldTransform;

let redacted = schema.transform(|_ty, field| {
    if field.name.as_ref() == "secret" {
        FieldTransform::Remove
    } else {
        FieldTransform::Keep
    }
})?;
```

`FieldTransform::Replace` must keep the field name. A transform that leaves the schema invalid
fails the rebuild with the usual validation errors.

## Add directives and types from SDL

```rust
let schema = schema.extend_sdl(
    r#"
    directive @tag(name: String!) on OBJECT | FIELD_DEFINITION
    type Health { ok: Boolean! }
    "#,
)?;
```

To apply a directive from Rust, use `Schema::type_directive` or the builder methods. See
[Directives](directives).

## What Add GraphQL does not do

This is schema composition, not Apollo Federation. There is no `_entities` resolver or subgraph
protocol. Use `merge`, `extend_sdl` and transforms to build public/internal schema variants, or
run separate schemas behind separate endpoints.

Rust resolver functions cannot be serialised into SDL. An extension adds fields without
resolvers; reopen the object in Rust to install them.

## Next

- [Printing schemas](../guide/printing-schemas)
- [Directives](directives)
- [Schema evolution](../guide/printing-schemas)
