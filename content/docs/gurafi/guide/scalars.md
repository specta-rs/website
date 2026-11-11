---
title: "Scalars"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/scalars.md"
---

Every GraphQL field ultimately returns a scalar. `gurafi` maps ordinary Rust types to the built-in
scalars and lets a newtype become a custom scalar without writing conversions by hand.

## Built-in mappings

| Rust type | GraphQL type |
| --- | --- |
| `String`, `&str`, `Cow<str>` | `String!` |
| `bool` | `Boolean!` |
| `i8`, `i16`, `i32`, `u8`, `u16` | `Int!` |
| `f32`, `f64` | `Float!` |
| `gurafi::ID` | `ID!` |
| `Option<T>` | `T`, outer non-null removed |
| `Vec<T>` | `[T]!` |
| `Box<T>`, `Arc<T>` | `T` |
| derived object, enum, scalar, union | its GraphQL name |

See [Nullability](nullability) for wrapper details.

## `ID`

Use `gurafi::ID` for identifiers. It serializes as a GraphQL `ID` string even when an integer is
supplied:

```rust
use gurafi::ID;

o.field("id", |u: &User, _: gurafi::NoArgs, _: &Ctx| ID::new(u.id.clone()));
```

`ID::new` accepts `impl Into<String>`. `ID` also implements `From<String>` and `From<&str>`.

## Derived newtype scalars

`#[derive(Scalar)]` turns a newtype into a scalar that delegates to its inner type:

```rust
use gurafi::Scalar;

#[derive(Scalar, Clone)]
#[graphql(
    name = "Date",
    description = "An ISO-8601 calendar date.",
    specified_by = "https://example.com/date"
)]
struct Date(String);
```

The inner type's `IntoValue`/`FromValue` conversions are used. That means an invalid date is only
rejected if you add validation; the derive is a naming and schema-registration shortcut, not a
parser.

## Validated scalars

For real validation, implement `ScalarValue` directly:

```rust
use gurafi::{ScalarValue, gql::{GraphQLError, Value}};

#[derive(Clone)]
struct Email(String);

impl ScalarValue for Email {
    const NAME: &'static str = "Email";

    fn description() -> Option<&'static str> {
        Some("A validated email address.")
    }

    fn to_value(&self) -> Result<Value, GraphQLError> {
        Ok(Value::from(self.0.clone()))
    }

    fn from_value(value: &Value) -> Result<Self, GraphQLError> {
        let Some(text) = value.as_str() else {
            return Err(GraphQLError::new("Email must be a string"));
        };
        if text.contains('@') {
            Ok(Self(text.to_owned()))
        } else {
            Err(GraphQLError::new("Email must contain `@`"))
        }
    }
}

gurafi::impl_scalar_traits!(Email);
```

`impl_scalar_traits!` supplies `OutputType`, `InputType`, `IntoValue` and `FromValue` from the
`ScalarValue` implementation. Register a scalar that does not appear in a field signature with
`schema.scalar::<Email>()`.

## Literal coercion

`ScalarValue::from_literal` defaults to accepting the ordinary GraphQL literal forms. Override it
when an input literal needs a different representation, for example when an enum-like string
should become a structured value. The method receives the parsed AST literal and returns the
runtime `Value`.

## `@specifiedBy`

`#[graphql(specified_by = "...")]` or `ScalarValue::specified_by()` adds the standard
`@specifiedBy(url: ...)` directive. It documents the scalar's wire format; it does not validate
it.

## Output conversion

A resolver's `IntoValue` implementation converts the Rust value. For a custom scalar this is
`ScalarValue::to_value`, so output validation runs during field completion and becomes a field
error rather than a panic.

## Next

- [Input objects](inputs)
- [Enums](enums)
- [Interfaces](interfaces)
