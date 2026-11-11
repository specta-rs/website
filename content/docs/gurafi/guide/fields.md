---
title: "Fields"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/fields.md"
---

Fields for object and interface types are declared on the builder. Each field carries its
resolver, arguments, GraphQL type and options in one place. The same options apply to root
fields, which omit the model argument.

## Scalar fields

The simplest field reads a property:

```rust
schema.object::<Giraffe>(|o| {
    o.expose(expose!(Giraffe::name));
    o.expose(expose!(Giraffe::height_in_meters as "height"));
});
```

Or computes a value with a resolver:

```rust
o.field("name", |g: &Giraffe, _: gurafi::NoArgs, _: &Ctx| g.name.clone());
```

There are no separate scalar helper methods. The GraphQL type comes from the resolver's Rust
return type, so a `String` is `String!`, an `i32` is `Int!`, and so on. The compiler checks the
type instead of a string type name.

## Resolver shapes

Object fields receive the parent model, their arguments and the request context. Four shapes
cover sync/async and fallible/infallible resolvers:

| Method | Sync/async | Failure |
| --- | --- | --- |
| `field` | sync | infallible |
| `field_result` | sync | `Result<T, gql::GraphQLError>` |
| `field_async` | async | infallible |
| `field_result_async` | async | `Result<T, gql::GraphQLError>` |

Each has a `*_with_info` variant that appends `&gql::ResolveInfo<'_>`:

```rust
o.field_with_info("path", |g: &Giraffe, _: NoArgs, _: &Ctx, info| {
    format!("{}.{}", info.parent_type, info.field_name)
});
```

Root fields use the same methods without the model argument:

```rust
schema.query(|q| {
    q.field("giraffe", |_: NoArgs, _: &Ctx| current_giraffe());
    q.field_result("find", |args: FindArgs, ctx: &Ctx| find(args, ctx));
});
```

`field_with_execution` / `field_result_with_execution` append `&gql::ResolverContext<'_>`, which
exposes the execution context for response extensions:

```rust
o.field_with_execution("name", |g: &Giraffe, _: NoArgs, _: &Ctx, execution| {
    execution.context.set_extension("servedBy", "gurafi");
    g.name.clone()
});
```

## Lists

Lists come from Rust collections. `Vec<T>` becomes `[T]!`; the item type keeps its own
nullability:

```rust
o.field("names", |g: &Giraffe, _: NoArgs, _: &Ctx| g.names.clone());          // [String!]!
o.field("tags", |g: &Giraffe, _: NoArgs, _: &Ctx| g.tags.clone());            // [String!]!
o.field("maybe", |g: &Giraffe, _: NoArgs, _: &Ctx| g.maybe.clone());          // [String]!
```

Use field options when the Rust type is truthful but the API needs a different wrapper:

```rust
.field(...).nullable_items()   // [String!]! -> [String]!
.field(...).non_null_items()   // [String]!   -> [String!]!
.field(...).nullable()         // String!     -> String
.field(...).non_null()         // checked: the Rust type must not be Option
```

Overrides are checked at build time. A nullable Rust position can never be made non-null, and a
list shape must match the Rust collection. See [Nullability](nullability) for the full rules.

## Arguments

A resolver's second parameter is its arguments type. Derive `Args` and the GraphQL arguments
follow automatically:

```rust
use gurafi::Args;

#[derive(Args)]
struct FriendsArgs {
    #[graphql(description = "Max results", default = 10)]
    limit: i32,
    after: Option<String>,
}

o.field_result("friends", |g: &Giraffe, args: FriendsArgs, _: &Ctx| {
    fetch_friends(g, args.limit, args.after)
});
```

`Args` produces arguments on the field; it does not register a named input type. See [Using
args](args) and [Input objects](inputs).

## Exposing fields from the model

`expose!` reads a property and infers both the field name and the GraphQL type:

```rust
o.expose(expose!(Giraffe::name));                       // field `name`
o.expose(expose!(Giraffe::height_in_meters as "height")); // field `height`
o.expose(expose!(Giraffe::keeper::nickname));             // field `nickname`
```

The macro requires an object model; it is not available on root types. For a computed or
transformed value, use a resolver.

## Field options

`field`, `expose` and the root variants return `FieldConfig`. Options apply when the statement
ends:

```rust
o.expose(expose!(Giraffe::height))
    .description("Height in meters.")
    .deprecated("Use heightMeters.")
    .complexity(2)
    .auth(|ctx: &Ctx| ctx.user.is_some())
    .auth_error("Sign in to read heights.");
```

`FieldConfig` also has:

| Method | Effect |
| --- | --- |
| `validate::<A>(...)` | run an argument validator after coercion and input validation |
| `as_type::<T>()` / `returns::<T>()` | checked replacement of the named GraphQL type |
| `as_abstract(&interface_or_union)` | declare an abstract output type |
| `as_object_ref(&object_ref)` | use a runtime object name |
| `as_dynamic(TypeRef)` | explicit type reference for raw/dynamic fields |
| `nullable` / `non_null` | change the field's nullability |
| `nullable_items` / `non_null_items` | change list-item nullability |
| `directive(AppliedDirective)` | apply a custom directive |

Type-level authorization is declared on the object or interface and inherited by every field.
See [Scope auth](../plugins/scope-auth).

## Adding fields to an existing type

`object`, `object_fields` and `object_field` can be called repeatedly:

```rust
schema.object::<Giraffe>(|o| {
    o.expose(expose!(Giraffe::name));
});

schema.object_field::<Giraffe, _, NoArgs, _>("height", |g, _: NoArgs, _: &Ctx| {
    g.height_in_meters
});
```

The same pattern works for `interface` / `interface_fields` and the root builders. This is how
a large type is split across modules.

## Nested lists

Rust expresses nested lists directly:

```rust
fn matrix() -> Vec<Vec<String>> { vec![vec!["a".into(), "b".into()]] }

q.field("matrix", |_: NoArgs, _: &Ctx| matrix()); // [[String!]!]!
```

To make inner items or lists nullable, use `Option` in the collection type or the field options
where the Rust type already permits it.

## Next

- [Using args](args)
- [Nullability](nullability)
- [Typed errors](../plugins/errors)
- [Using plugins](using-plugins)
