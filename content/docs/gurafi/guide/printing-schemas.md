---
title: "Printing schemas"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/printing-schemas.md"
---

A built `gql::Schema` is the source of truth. Print it as SDL, snapshot it in tests, diff two
versions, or compose schemas at build time.

## Print SDL

```rust
let sdl = schema.sdl();
std::fs::write("schema.graphql", sdl)?;
```

The printer emits the schema definition when needed, custom directives, and every type in
registration order. Built-in scalars and introspection types are omitted because clients already
know them. `BuildOptions::sort_types(true)` gives stable alphabetical type order.

## Parse SDL

```rust
let schema = gql::Schema::from_sdl(include_str!("schema.graphql"))?;
```

An explicit `schema { ... }` definition is authoritative: only the roots it names are roots.
Without a schema definition, default-named `Query`, `Mutation` and `Subscription` types are
inferred. The parser validates directive locations, argument types and defaults.

## Diff schemas

```rust
let diff = gql::diff(&old_schema, &new_schema);
for change in diff.changes() {
    println!("{change:?}");
}
```

The diff reports breaking changes for types, fields, arguments, enums, unions, interfaces, inputs
and directives. Use it in CI to reject an accidental removal or a narrowed type.

## Merge schemas

`gql::Schema::merge` combines two schemas. A duplicate type is accepted only when the definitions
are structurally identical; conflict detection includes resolvers and runtime hooks. If both
sides set different resolver implementations for the same field, the merge fails instead of
choosing by argument order.

```rust
let merged = public.merge(&internal)?;
```

Directive applications and directive locations are compared without regard to order (repeatable
directives as a multiset). Runtime behaviour — resolvers, subscription resolvers, complexity
estimators, `is_type_of`, `resolve_type`, scalar coercion — is preserved from whichever side
sets it; conflicting implementations are an error.

## Extend with SDL

```rust
let extended = schema.extend_sdl("extend type Query { health: String }")?;
```

`extend_sdl` prints the current schema, appends the extension document and rebuilds. Resolvers
for fields that still exist are overlaid onto the result. Use `extend_sdl_many` to apply several
documents in one build:

```rust
let extended = schema.extend_sdl_many([
    include_str!("extensions/health.graphql"),
    include_str!("extensions/admin.graphql"),
])?;
```

`extend_sdl` is O(schema size) per call; `extend_sdl_many` is the right API for a set of
extensions.

## Filter and transform

Remove public types before exposing an internal schema:

```rust
let public = schema.without_types(&["InternalAudit", "FeatureFlag"])?;
```

Keep only a selected set:

```rust
let public = schema.retain_types(|ty| !ty.name().starts_with("Internal"))?;
```

Rewrite fields:

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

`FieldTransform::Replace` must keep the field name. Removing a type that is still referenced is a
validation error rather than a dangling schema.

`SchemaTransform` is a reusable filter:

```rust
let public = gql::SchemaTransform::new()
    .keep("Query")
    .keep("User")
    .remove("InternalAudit")
    .apply(&schema)?;
```

## Introspection

Use a standard introspection query through `suku` or `gql::execute`. The response contains
`__schema` types, directives and descriptions. `suku` can disable introspection for production
while keeping the schema available to the application.

## Composition workflow

A common setup builds an internal schema, derives a public variant, and prints both:

```rust
let internal = build_internal_schema()?;
let public = internal.without_types(&["InternalAudit"])?;

std::fs::write("schema.public.graphql", public.sdl())?;
std::fs::write("schema.internal.graphql", internal.sdl())?;
```

Diff the previous public SDL against the new one in CI. Clients generate from the public file;
the internal file stays server-side.

## Next

- [Schema builder](schema-builder)
- [Add GraphQL](../plugins/add-graphql)
- [Client types](client-codegen)
