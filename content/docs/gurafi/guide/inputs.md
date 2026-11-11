---
title: "Input objects"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/inputs.md"
---

A GraphQL input object is a reusable structure accepted by a field or nested inside another
input. `#[derive(Input)]` implements the Rust side. `#[derive(Args)]` is an alias whose default
form is "this type is only a field's argument list".

## Arguments versus named inputs

`Args` without a name produces top-level arguments and no extra GraphQL type:

```rust
#[derive(gurafi::Args)]
struct FriendsArgs {
    #[graphql(default = 10)]
    limit: i32,
    after: Option<String>,
}
```

The field declares `friends(limit: Int! = 10, after: String)`. There is no `FriendsArgs` input
object in the schema.

When the type is nested inside another input, give it a GraphQL name:

```rust
#[derive(gurafi::Input)]
#[graphql(name = "FilterInput")]
struct Filter {
    prefix: Option<String>,
    color: Option<Color>,
}

#[derive(gurafi::Args)]
struct SearchArgs {
    filter: Option<Filter>,
}
```

Using an unnamed input in a nested position is a build error that tells you to add a
`#[graphql(name = "...")]`.

## Fields and defaults

Every Rust field becomes an input field:

```rust
#[derive(gurafi::Input)]
#[graphql(name = "PageInput")]
struct Page {
    #[graphql(description = "Number of items to return.", default = 20)]
    first: i32,
    #[graphql(default_with = "default_cursor")]
    after: Option<String>,
}

fn default_cursor() -> Option<String> {
    Some(String::new())
}
```

- `Option<T>` is optional and nullable.
- A non-`Option` field without a default is required and non-null.
- A default applies when the field is omitted. An explicit `null` is still `None`.
- A default can be a Rust expression. `#[derive(Input)]` implements `IntoValue`, so a default can
  be a value of that type:

```rust
#[derive(gurafi::Input)]
#[graphql(name = "ListInput")]
struct ListInput {
    #[graphql(default = Page { first: 3, after: None })]
    page: Page,
}
```

## Validation

Validation runs after coercion and before the resolver. On a field the function receives the
field's Rust type; on the input type it receives `&Self`:

```rust
fn non_empty(value: &str) -> Result<(), gql::GraphQLError> {
    if value.trim().is_empty() {
        Err(gql::GraphQLError::new("must not be empty"))
    } else {
        Ok(())
    }
}

#[derive(gurafi::Input)]
#[graphql(name = "CreateInput")]
struct CreateInput {
    #[graphql(validate = "non_empty")]
    name: String,
}
```

For rules that need the request context, use `FieldConfig::validate::<ArgsType>(...)`. It runs
after input-level validation and before the resolver.

## One-of inputs

```rust
#[derive(gurafi::Input)]
#[graphql(name = "SearchBy", one_of)]
struct SearchBy {
    id: Option<gurafi::ID>,
    name: Option<String>,
}
```

The generated input uses `@oneOf`. Every field must be `Option<T>`, no field may have a default,
and clients must send exactly one non-null field. A one-of input is an input object; wrap it in an
args type if a field should take it as its only argument.

## Descriptions and deprecations

```rust
#[derive(gurafi::Input)]
#[graphql(name = "LegacyInput")]
struct LegacyInput {
    #[graphql(description = "Old name.", deprecated = "Use `name`.")]
    old_name: Option<String>,
    name: Option<String>,
}
```

`#[graphql(deprecated)]` uses the specification's default reason.

## Type mapping

Input fields use the same Rust mapping as fields: `String`/`i32`/`bool`/`f64`, `Option`, `Vec`,
derived enums, derived named inputs, custom scalars and `ID`. Output-only types — objects,
interfaces and unions — cannot appear in an input.

## Rules for derived inputs

- Structs only. Tuple structs and enums are not input objects.
- No generics.
- Named inputs must not shadow a built-in scalar name (`String`, `Int`, `Float`, `Boolean`, `ID`).
- `#[graphql(one_of)]` and `#[graphql(validate)]` are type-level attributes.
- Field attributes are `name`, `description`, `default`, `default_with`, `deprecated` and
  `validate`.

## Next

- [Using args](args)
- [Validation](../plugins/validation)
- [Directives](../plugins/directives)
