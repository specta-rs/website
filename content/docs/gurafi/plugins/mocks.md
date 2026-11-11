---
title: "Mocks"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/mocks.md"
---

`MockPlugin` replaces exact `Type.field` resolvers with fixed values for tests, storybook-style
fixtures and local development. Everything else keeps running normally.

```rust
use gurafi::{MockPlugin, Object, Schema, expose};

#[derive(Object)]
struct User {
    name: String,
}

struct Ctx;

let mut schema = Schema::<Ctx>::new();
schema.plugin(
    MockPlugin::new()
        .mock("User", "name", "Mocked Ada")
        .mock_path("Query.viewer", gql::Value::external(User {
            name: "Fixture".into(),
        })),
);

schema.object::<User>(|o| {
    o.expose(expose!(User::name));
});

schema.query(|q| {
    q.field("viewer", |_: NoArgs, _: &Ctx| User { name: "real".into() });
});
```

`mock(type_name, field_name, value)` and `mock_path("Type.field", value)` are equivalent.
`value` accepts anything implementing `Into<gql::Value>`, including models via
`gql::Value::external`.

## What a mock replaces

A mock replaces the field's resolver. That means:

- the original resolver does not run;
- its argument validator does not run;
- field-level `.auth(...)` does not run.

Object-level and interface-level authorization is installed outside the plugin chain, so it still
runs and cannot be bypassed by a mock. If a mocked field must also enforce a scope, use an object
rule or a wrapping plugin placed before the mock.

## Subscriptions

A mocked subscription keeps its real stream and returns the mock for every event. That is useful
for client work: the transport and subscription lifecycle are real, while the payload is stable.

## Per-environment installation

Mocks are installed at build time. Choose them from configuration before `build()`:

```rust
if std::env::var("GRAPHQL_MOCKS").as_deref() == Ok("1") {
    schema.plugin(MockPlugin::new().mock_path("Query.viewer", fixture_user()));
}
```

Do not install mocks in production. They are not a runtime permission check.

## Writing a custom mock plugin

For generated data or randomized fixtures, implement `Plugin::wrap_resolve` and return a value
without calling `next`:

```rust
use gurafi::{FieldMeta, Plugin};

struct RandomName;

impl Plugin<Ctx> for RandomName {
    fn wrap_resolve(&self, meta: &FieldMeta<'_>, next: gql::ResolveFn) -> gql::ResolveFn {
        if meta.path() == "User.name" {
            return std::sync::Arc::new(|_| Box::pin(async {
                Ok(gql::Value::from("Random"))
            }));
        }
        next
    }
}
```

## Next

- [Using plugins](../guide/using-plugins)
- [Writing plugins](../guide/writing-plugins)
- [Troubleshooting](../guide/troubleshooting)
