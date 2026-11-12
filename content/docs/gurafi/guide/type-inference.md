---
title: "Type inference"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/type-inference.md"
---

`gurafi` infers the GraphQL type from Rust. The compiler checks the resolver signature, and the
schema build checks the resulting type graph.

## What is inferred

```rust
o.field("name", |g: &Giraffe, _: NoArgs, _: &Ctx| g.name.clone());
// String -> String!

o.field("age", |g: &Giraffe, _: NoArgs, _: &Ctx| g.age);
// Option<u8> -> Int

o.field("friends", |g: &Giraffe, _: NoArgs, _: &Ctx| g.friends.clone());
// Vec<User> -> [User!]!
```

The return type of the resolver is the source of truth. The backing model does not need a field
with the same name; a computed field can return any supported type.

## Arguments

The second resolver parameter is the argument type. Its derive supplies the GraphQL argument
list:

```rust
#[derive(Args)]
struct FindArgs {
    name: String,
    limit: Option<i32>,
}

q.field("find", |args: FindArgs, _: &Ctx| find(args));
// find(name: String!, limit: Int): ...
```

There is no separate argument map to maintain.

## Supported type constructors

| Rust | GraphQL |
| --- | --- |
| `Option<T>` | nullable `T` |
| `Vec<T>` | non-null list of `T` |
| `Box<T>`, `Arc<T>` | `T` |
| `Raw<T>` | `T`, but the value is a prebuilt `gql::Value` |
| derived object/interface/union | named type |
| derived enum | named enum |
| `ID`, `String`, numbers, `bool` | built-in scalar |

`Result<T, E>` is deliberately not an output type. Use `field_result` for a GraphQL error, or
`field_result_union` when the error is part of the API.

## Runtime names

When a type's name is only known at runtime, use `ObjectRef`, `InterfaceRef` or `UnionRef`:

```rust
let admin = schema.object_ref::<User>("AdminUser");
q.field_ref(&admin, "admin", |_: NoArgs, _: &Ctx| current_admin());
```

`field_ref` preserves the wrapper inference from `T`: `User` is `AdminUser`, `Vec<User>` is
`[AdminUser]!`. For abstract types or explicit wrappers, use `field_ref_type`:

```rust
q.field_ref_type::<SearchResult, NoArgs, _>(
    search.type_ref(),
    "search",
    |_, _| search_results(),
)
.as_abstract(&search);
```

The build checks that the declared wrappers are compatible with the Rust type and that the named
type exists.

## What is not inferred

- Field names are explicit, except for `expose!`, which names the GraphQL field from the Rust
  property.
- Object fields are not derived from struct fields. This is intentional: every field needs a
  resolver, arguments and access policy, and deriving them would hide those decisions.
- Input types must be named when nested; the derive cannot guess a stable public name.
- A runtime type name cannot be inferred from a value. Use a reference.

## Inference failures

A type that does not implement `OutputType` or `InputType` produces a compile error at the field
or argument declaration. A referenced type that is never registered is a build error:

```text
Object type `User` is used by a field but was never registered. Call
`schema.object::<...>(...)` or `schema.object_ref::<...>("User")` before calling `build()`.
```

See [Troubleshooting](troubleshooting) for the common messages.

## Next

- [Fields](fields)
- [Nullability](nullability)
- [Schema builder](schema-builder)
