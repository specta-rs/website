---
title: "Simple objects"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/simple-objects.md"
---

Plain data objects are the default path in `gurafi`: derive `Object`, then expose properties or
return prebuilt values.

## Data-shaped objects

```rust
use gurafi::{Object, Schema, expose};

#[derive(Object)]
struct Giraffe {
    name: String,
    height_in_meters: f64,
}

schema.object::<Giraffe>(|o| {
    o.expose(expose!(Giraffe::name));
    o.expose(expose!(Giraffe::height_in_meters as "height"));
});
```

There is no separate "simple object" registration. The derive supplies the GraphQL name and the
`is_type_of` check; `expose!` supplies one resolver per property. This is the smallest object and
the one to use for plain data.

## Values that already look like GraphQL

When a resolver already has a complete object, use `Raw<T>`:

```rust
use gurafi::{Raw, RawObject};

schema.object::<Giraffe>(|o| {
    o.raw_field::<String>("name");
    o.raw_field::<f64>("height");
});

q.field("giraffe", |_: NoArgs, _: &Ctx| {
    Raw::<Giraffe>::object(
        RawObject::new()
            .field("name", "Melman")
            .field("height", 5.2)
            .build(),
    )
});
```

`Raw<T>` keeps the GraphQL type derived from `T`, but the executor reads fields from the value
map instead of calling a resolver per field. Use it for cached JSON or upstream responses. Do not
mix raw fields and resolver-backed fields on one object.

## When not to use a simple object

Use a normal object with explicit fields when a field needs:

- arguments (`field_result` + an args type),
- authorization or validation,
- a computed value,
- a loader or async I/O.

`expose!` and `raw_field` are fast paths for read-only data; they do not replace resolvers that
need request state.

## Next

- [Objects](../guide/objects)
- [Fields](../guide/fields)
- [Patterns](../guide/patterns#prebuilt-values)
