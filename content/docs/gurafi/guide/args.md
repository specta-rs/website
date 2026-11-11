---
title: "Using args"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/args.md"
---

Arguments let a client pass values to a field. In `gurafi` they are a Rust struct, not a separate
declaration. The resolver receives the struct by value, already coerced and validated.

## Scalars and required arguments

```rust
use gurafi::{Args, NoArgs, Schema};

#[derive(Args)]
struct GreetingArgs {
    name: String,
}

schema.query(|q| {
    q.field("greeting", |args: GreetingArgs, _: &()| format!("Hello, {}!", args.name));
});
```

`name: String` is required and non-null: the generated argument is `name: String!`. An
`Option<T>` is optional and nullable:

```rust
#[derive(Args)]
struct RepeatArgs {
    text: String,
    times: Option<i32>,
}
```

The query can omit `times` or pass `null`; the resolver sees `None` in both cases.

## Defaults

`#[graphql(default = ...)]` gives an omitted argument a value. An explicit `null` is still
`None`; a default does not replace it.

```rust
#[derive(Args)]
struct RepeatArgs {
    text: String,
    #[graphql(default = 2)]
    times: i32,
}
```

For a computed default, use `#[graphql(default_with = "path")]`, where `path()` returns the field
type.

## Lists

`Vec<T>` produces a list argument. Items are non-null unless the Rust item is `Option`:

```rust
#[derive(Args)]
struct FindArgs {
    names: Vec<String>,           // [String!]!
    maybe_names: Vec<Option<String>>, // [String]!
    optional: Option<Vec<String>>,    // [String!]
}
```

The same nullability overrides are available on `FieldConfig`, but the safest form is to make the
Rust type express the contract.

## Enums and input objects

Input enums and named input objects are ordinary derived types:

```rust
#[derive(gurafi::Enum)]
enum LengthUnit {
    Feet,
    Meters,
}

#[derive(gurafi::Input)]
#[graphql(name = "GiraffeFilter")]
struct Filter {
    prefix: Option<String>,
    unit: Option<LengthUnit>,
}

#[derive(gurafi::Args)]
struct ListArgs {
    filter: Option<Filter>,
}
```

An input type used outside the top-level argument position must have a name
(`#[graphql(name = "...")]`). An unnamed `Args` type is a field's argument list, not a reusable
input object. Using one nested inside another is a build error that names the fix.

Output objects, interfaces and unions cannot be argument types.

## Nested lists

Use nested `Vec`s, with `Option` for the positions that can be null:

```rust
#[derive(gurafi::Args)]
struct CountArgs {
    groups: Vec<Vec<Option<String>>>,
}
```

This is `groups: [[String]!]!`: the outer list and each inner list are non-null, while strings
inside the inner lists may be null.

## Validation

There are two validation hooks.

`#[graphql(validate = "path")]` runs after coercion. On a field it receives `&FieldType`; on the
type it receives `&Self`:

```rust
fn valid_name(name: &str) -> Result<(), gql::GraphQLError> {
    if name.trim().is_empty() {
        Err(gql::GraphQLError::new("name must not be empty"))
    } else {
        Ok(())
    }
}

#[derive(gurafi::Input)]
struct CreateArgs {
    #[graphql(validate = "valid_name")]
    name: String,
}
```

When the rule needs request state, validate on the field builder:

```rust
q.field("create", |args: CreateArgs, _: &Ctx| args.name)
    .validate::<CreateArgs>(|args, ctx| {
        if ctx.user.is_some() {
            Ok(())
        } else {
            Err(gql::GraphQLError::new("sign in first"))
        }
    });
```

The type parameter must be the field's argument type. The hook runs after input-level validation
and before the resolver. The arguments are coerced once; subscription events reuse the args
validated at setup, and the field validator runs once per event.

Validation errors are client errors. `gurafi` attaches `BAD_USER_INPUT` so a server-side
`mask_internal` does not hide them.

## One-of inputs

```rust
#[derive(gurafi::Input)]
#[graphql(name = "SearchBy", one_of)]
struct SearchBy {
    id: Option<gurafi::ID>,
    name: Option<String>,
}
```

Every field must be `Option<T>`, no field may have a default, and a caller must provide exactly
one non-null field. Because a one-of input is an input object, use it inside an args type rather
than as the field's top-level argument list.

## No arguments

Use `gurafi::NoArgs` when a field takes no arguments:

```rust
q.field("health", |_: gurafi::NoArgs, _: &Ctx| "ok");
```

`NoArgs` avoids allocating an empty argument object on the hot path.

## Querying with arguments

```graphql
query Arguments {
  greeting(name: "Gina")
  repeat(text: "ha")
  once: repeat(text: "ha", times: null)
  knownGiraffes(names: ["Gina", "Unknown"])
  nonNullNames(names: ["Gina", null, "James"])
  giraffe {
    meters: height
    feet: height(unit: Feet)
  }
}
```

## Next

- [Input objects](inputs)
- [Validation](../plugins/validation)
- [Nullability](nullability)
