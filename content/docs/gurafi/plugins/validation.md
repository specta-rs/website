---
title: "Validation"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/validation.md"
---

Validation catches bad input before a resolver runs. It complements GraphQL type coercion:
coercion checks the shape, validation checks the domain rule.

## Field values

`#[graphql(validate = "path")]` runs after coercion. On a field it receives `&FieldType`; on an
input type it receives `&Self`:

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

The error becomes a field error. `gurafi` also tags argument coercion and input validation with
`extensions.code = "BAD_USER_INPUT"` so server-side masking keeps the message visible.

## Context-aware validation

Use `FieldConfig::validate::<ArgsType>(...)` when the rule needs the request context:

```rust
q.field("createUser", |args: CreateArgs, _: &Ctx| create_user(args))
    .validate::<CreateArgs>(|args, ctx| {
        if ctx.user.as_ref().is_some_and(|user| user.is_admin) {
            Ok(())
        } else {
            Err(gql::GraphQLError::new("only admins can create users"))
        }
    });
```

The type parameter must match the field's argument type. The hook runs after input-level
validation and before the resolver. Arguments are coerced once; subscription events reuse the
setup arguments and run the field validator once per event.

## One-of inputs

`#[graphql(one_of)]` is both a shape and a validation rule: exactly one non-null field must be
provided. See [Input objects](../guide/inputs#one-of-inputs).

## Scalar validation

A custom scalar's `ScalarValue::from_value` is the validation hook for that scalar. Return an
error for an invalid representation; the error is attached to the argument or input field.

```rust
impl ScalarValue for Email {
    const NAME: &'static str = "Email";

    fn to_value(&self) -> Result<gql::Value, gql::GraphQLError> {
        Ok(gql::Value::from(self.0.clone()))
    }

    fn from_value(value: &gql::Value) -> Result<Self, gql::GraphQLError> {
        let text = value.as_str().ok_or_else(|| gql::GraphQLError::new("expected a string"))?;
        if text.contains('@') {
            Ok(Self(text.to_owned()))
        } else {
            Err(gql::GraphQLError::new("invalid email"))
        }
    }
}
```

## Plugin-based validation

A plugin can validate fields by path or metadata before calling `next`. This is useful for a rule
that is uniform across a group of fields, such as a required scope:

```rust
schema.plugin(RequireScope("admin"));
```

Use field-level `.validate` for argument-specific rules and plugins for cross-cutting policy.

## Error handling

- Validation failures are GraphQL field errors with a response path.
- They do not panic and do not reach the resolver with unchecked data.
- Field-level auth and validation run before the resolver; a mock plugin that replaces the
  resolver skips both.
- `suku::mask_internal` keeps `BAD_USER_INPUT` and `UNAUTHORIZED` messages.

## Testing

```rust
let response = gql::execute(
    &schema,
    gql::Request::new(r#"mutation { createUser(name: "") { id } }"#),
    &gql::ExecutionOptions::default(),
).await;

assert!(response.errors.iter().any(|error| {
    error.extensions()
        .and_then(|extensions| extensions.get("code"))
        .and_then(gql::Value::as_str)
        == Some("BAD_USER_INPUT")
}));
```

## Next

- [Using args](../guide/args)
- [Input objects](../guide/inputs)
- [Scope auth](scope-auth)
