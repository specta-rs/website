---
title: "Nullability"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/nullability.md"
---

Rust expresses nullability with `Option<T>` and collection element types. `gurafi` maps that to
GraphQL wrappers and checks explicit overrides at build time.

## The default mapping

| Rust return type | GraphQL type |
| --- | --- |
| `String` | `String!` |
| `Option<String>` | `String` |
| `Vec<String>` | `[String!]!` |
| `Vec<Option<String>>` | `[String]!` |
| `Option<Vec<String>>` | `[String!]` |
| `Option<Vec<Option<String>>>` | `[String]` |
| `User` | `User` |
| `Option<User>` | `User` |

Objects, interfaces and unions are nullable by default because their derived `OutputType` is a
plain named type. Wrap them in `Option` when the resolver can return no value; the GraphQL type
is already nullable, so `Option<User>` and `User` print the same type. Use `non_null()` when an
object field must never be null.

Lists are non-null by default. The item type follows the Rust item type.

## Default nullability

Rust's idiomatic mapping is driven by `Option`: a non-`Option` value cannot be null, so it is
non-null; `Option<T>` is nullable. Use `Option<T>` whenever the resolver can return `None`, and
`non_null()` only when the backing model type itself requires it. The compiler and the build-time
checks keep the GraphQL wrapper honest.

## Explicit overrides

`FieldConfig` can adjust the wrappers when the Rust type is truthful:

```rust
.field(...).nullable()        // remove the field's outer !
.field(...).non_null()        // add !, only if the Rust type is not Option
.field(...).nullable_items()  // [T!]! -> [T]!
.field(...).non_null_items()  // [T]! -> [T!]!
```

Overrides are validated:

- A nullable Rust position cannot be made non-null. `Option<String>` cannot become `String!`.
- A list shape must match the Rust collection. `Vec<String>` cannot become `String!`.
- A non-list cannot use `nullable_items` / `non_null_items`.
- `non_null_items` trusts that the collection cannot contain `None`; use it only when that is
  true for the Rust type, or keep `Option` items and accept `[T]!`.

Use `.returns::<T>()` / `.as_type::<T>()` to replace the named type while preserving the
nullability contract. `field_ref_type` and `as_dynamic` similarly verify wrappers.

## Inputs

Input fields use the same mapping:

- `Option<T>` is optional and nullable.
- A non-`Option` field without a default is required and non-null.
- A default does not replace an explicit `null`.
- `#[graphql(default = ...)]` makes an omitted field use the default.

## Null propagation

If a non-null field resolves to `null`, the executor propagates null to the nearest nullable
parent, exactly as the GraphQL specification requires. Errors are collected at the field's path.
Use `Option` in the backing model to make `null` a legal result rather than an error.

## Next

- [Fields](fields)
- [Input objects](inputs)
- [Type inference](type-inference)
