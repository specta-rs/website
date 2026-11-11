---
title: "Objects"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/objects.md"
---

Define GraphQL object types from your application's data.

A Rust type is the backing model. `#[derive(Object)]` ties it to a GraphQL name and gives the
executor a way to recognise values of that type.

## Define an object type

```rust
use gurafi::{Object, Schema, expose};

#[derive(Object)]
/// A giraffe in the zoo.
struct Giraffe {
    name: String,
    birthday: String,
    height_in_meters: f64,
}
```

The Rust type name is the GraphQL name. Override it with an attribute:

```rust
#[derive(Object)]
#[graphql(name = "Giraffe", description = "A long-necked animal.")]
struct ZooAnimal {
    name: String,
}
```

A doc comment becomes the description unless `#[graphql(description = "...")]` is supplied.

Fields are not derived. Declare them on the schema builder, where the resolver, arguments and
access rules live:

```rust
let mut schema = Schema::<()>::new();

schema.object::<Giraffe>(|o| {
    o.description("A giraffe in the zoo.");
    o.expose(expose!(Giraffe::name));
    o.expose(expose!(Giraffe::height_in_meters as "height"));
    o.field("birthYear", |g: &Giraffe, _: gurafi::NoArgs, _: &()| {
        g.birthday.get(..4).and_then(|year| year.parse::<i32>().ok())
    });
});
```

The model and the GraphQL API can have different shapes. `heightInMeters` is exposed as `height`;
`birthday` is available to resolvers but not exposed as a field. Computed fields do not need new
properties on the model.

`expose!` supports nested properties:

```rust
o.expose(expose!(Giraffe::keeper::nickname));
```

## Add a query

```rust
schema.query(|q| {
    q.field("giraffe", |_: gurafi::NoArgs, _: &()| Giraffe {
        name: "James".into(),
        birthday: "2012-12-12".into(),
        height_in_meters: 5.2,
    });
});

let schema = schema.build().expect("valid schema");
```

Query the object:

```graphql
query {
  giraffe {
    name
    birthYear
    height
  }
}
```

## Refs and runtime names

Rust already has a typed reference to the model: the type itself. For names that are not known
until the application runs — Relay connections and mutation payloads are the usual cases — use an
object reference:

```rust
let admin = schema.object_ref::<User>("AdminUser");

schema.implement(&admin, |o| {
    o.expose(expose!(User::name));
});

schema.query(|q| {
    q.field_ref(&admin, "admin", |_: gurafi::NoArgs, _: &Ctx| current_admin());
});
```

`object_ref` creates or reopens the named type. `implement` adds fields, exactly like `object`.
The same name and model merge; a different Rust model claiming the name is a build error.
`field_ref` takes list and nullability wrappers from the resolver's return type and replaces only
the named type. See [runtime-named types](schema-builder#runtime-named-types).

## Splitting a definition across modules

`object` reopens an existing object, so a type can be declared in several modules or files.
Descriptions, interfaces and the generated `is_type_of` check are preserved. A field name
declared twice is still a build error.

```rust
schema.object::<Giraffe>(|o| {
    o.expose(expose!(Giraffe::name));
});

// Another module, or later in the same one.
schema.object_fields::<Giraffe>(|o| {
    o.field("height", |g: &Giraffe, _: gurafi::NoArgs, _: &()| g.height_in_meters);
});
```

`interface` / `interface_fields`, `query` / `query_fields`, `mutation` / `mutation_fields` and
`subscription` / `subscription_fields` behave the same way. Root declarations append; the
`*_fields` spelling just states the intent.

## How values travel

A resolver returns the Rust model. `gurafi` converts it to `gql::Value::External`, so the
executor can pass a borrowed `&Giraffe` to every child resolver without cloning the object. The
derived `is_type_of` check recognises that model when an abstract field needs its concrete type.

This is why a model type is the first argument of every object resolver:

```rust
o.field("name", |g: &Giraffe, _: NoArgs, _: &Ctx| g.name.clone());
```

The borrow lasts for the resolver call. If a resolver needs to return an owned value, return a
clone or construct a new model.

## Required trait bounds

`#[derive(Object)]` requires the type to be `Send + Sync + 'static`. Derive `Clone` if resolvers
or loaders need to return copies. For types that are not `Clone`, return references from
resolvers where possible or construct the value from data.

Objects are registered by name in `gql`. A field may return a type registered later; `build()`
reports a referenced type that was never registered, with the missing name and the fix.

## Next

- [Fields](fields) covers resolver shapes, lists and nullability.
- [Interfaces](interfaces) and [unions](unions) add abstract output types.
- [Runtime-named types](schema-builder#runtime-named-types) covers Relay-style names.
- [Raw values](patterns#prebuilt-values) covers resolving a whole object from a value you
  already have.
