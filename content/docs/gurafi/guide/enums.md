---
title: "Enums"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/enums.md"
---

A GraphQL enum is a Rust enum with unit variants. Derive `Enum` and use the type in fields or
arguments; registration is automatic.

```rust
use gurafi::Enum;

#[derive(Enum, Clone, Copy, PartialEq, Eq)]
enum LengthUnit {
    Feet,
    Meters,
}

#[derive(Enum)]
enum Color {
    #[graphql(name = "RED")]
    Red,
    Blue,
}
```

Variant names are used verbatim unless `#[graphql(name = "...")]` overrides them. GraphQL
convention is `SCREAMING_CASE`, but the Rust name is not rewritten silently.

Add descriptions and deprecations:

```rust
#[derive(Enum)]
enum Status {
    /// The job is waiting.
    Queued,
    #[graphql(deprecated = "Use Queued.")]
    Pending,
    #[graphql(description = "The job finished successfully.")]
    Done,
}
```

An enum variant can be deprecated with the standard reason by writing
`#[graphql(deprecated)]`.

Use an enum in an object field:

```rust
schema.object::<Giraffe>(|o| {
    o.field("unit", |g: &Giraffe, _: gurafi::NoArgs, _: &Ctx| g.unit);
});
```

Or in arguments:

```rust
#[derive(gurafi::Args)]
struct HeightArgs {
    unit: Option<LengthUnit>,
}
```

Enums are automatically registered when a field or argument references them. Call
`schema.enum_type::<LengthUnit>()` when an enum is part of the public schema but does not appear
in any signature.

Rust derive restrictions:

- Enums with data (tuple or struct variants) are not GraphQL enums. Use an object or a union.
- Generic enums are not supported.
- The variant order is the declaration order and is preserved in SDL output.

A custom enum value that does not match the Rust variant name is a GraphQL mapping concern, not a
runtime conversion. `#[graphql(name = "...")]` is the supported way to change the wire value.

## Next

- [Scalars](scalars)
- [Input objects](inputs)
- [Unions](unions)
