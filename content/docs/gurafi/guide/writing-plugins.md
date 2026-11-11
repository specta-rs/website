---
title: "Writing plugins"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/writing-plugins.md"
---

A plugin is a Rust value implementing `Plugin<Ctx>`. It can inspect field metadata, mutate the
field definition, wrap resolvers or subscriptions, and configure the schema builder.

```rust
use gurafi::{FieldMeta, Plugin};

pub trait Plugin<Ctx: 'static>: Send + Sync + 'static {
    fn field(&self, meta: &FieldMeta<'_>, field: &mut gql::Field) {}
    fn wrap_resolve(&self, meta: &FieldMeta<'_>, next: gql::ResolveFn) -> gql::ResolveFn { next }
    fn wrap_subscribe(&self, meta: &FieldMeta<'_>, next: gql::SubscribeFn) -> gql::SubscribeFn { next }
    fn configure(&self, builder: &mut gql::SchemaBuilder) {}
}
```

`Plugin` requires `Send + Sync + 'static` because `Schema` is `Clone` and a built schema may be
used from any thread. Put shared mutable state behind `Arc<Mutex<...>>` or atomics.

## Field metadata

`FieldMeta` describes one field after interface inheritance and type overrides:

| Field | Meaning |
| --- | --- |
| `type_name` | Declaring type, or the configured root name |
| `field_name` | The GraphQL field name |
| `return_type` | Final return type |
| `args` | Final argument declarations, in order |
| `is_root` | Query, mutation or subscription root field |
| `is_subscription` | Subscription root field only |

`meta.path()` returns `"Type.field"`.

The `field` hook can change the description, deprecation reason, complexity, directives,
arguments or type.

```rust
use gurafi::{FieldMeta, Plugin};

struct DescribeRoots;

impl Plugin<Ctx> for DescribeRoots {
    fn field(&self, meta: &FieldMeta<'_>, field: &mut gql::Field) {
        if meta.is_root {
            field.description = Some(format!("Root field `{}`", meta.field_name).into());
        }
    }
}
```

## Wrapping a resolver

`wrap_resolve` receives the next resolver and returns a new one. Call `next(context).await` to
preserve the original behaviour, or return directly to replace it.

```rust
use std::sync::Arc;

use gurafi::{FieldMeta, GraphQLError, Plugin};

struct RequireScope(&'static str);

impl Plugin<Ctx> for RequireScope {
    fn wrap_resolve(&self, _meta: &FieldMeta<'_>, next: gql::ResolveFn) -> gql::ResolveFn {
        let scope = self.0;
        Arc::new(move |context| {
            let next = Arc::clone(&next);
            Box::pin(async move {
                let ctx = context.context.require_data::<Ctx>()?;
                if !ctx.scopes.iter().any(|granted| granted == scope) {
                    return Err(GraphQLError::new(format!("missing scope `{scope}`")));
                }
                next(context).await
            })
        })
    }
}
```

A wrapping plugin sees the same `ResolverContext` as the resolver, including arguments and
`ResolveInfo`. Keep the future `Send` and avoid holding a lock across an `await`.

`wrap_subscribe` has the same shape for subscription setup resolvers. It wraps the function that
creates the stream, not each event.

## Configuring the schema

`configure` runs once after every type and root is registered:

```rust
use gurafi::{Plugin, gql::SchemaBuilder};

struct AddSchemaMetadata;

impl Plugin<Ctx> for AddSchemaMetadata {
    fn configure(&self, builder: &mut SchemaBuilder) {
        // Add schema directives, register a directive definition, or add a type.
    }

    fn field(&self, _meta: &gurafi::FieldMeta<'_>, _field: &mut gql::Field) {}
}
```

## Coverage and idempotence

Plugins are applied to the builder's declarations at build time. A type reopened in another
module is visited once with its final fields. `build_clone` visits the clone, not the original,
so wrapper functions do not stack.

If a plugin only needs field metadata, leave the resolver untouched. That preserves the
executor's leaf and raw-object fast paths.

## A counting plugin

```rust
use std::sync::{Arc, Mutex};

use gurafi::{FieldMeta, Plugin};

#[derive(Clone)]
struct CountFields {
    paths: Arc<Mutex<Vec<String>>>,
}

impl Plugin<Ctx> for CountFields {
    fn field(&self, meta: &FieldMeta<'_>, _field: &mut gql::Field) {
        self.paths.lock().unwrap().push(meta.path());
    }
}

let paths = Arc::new(Mutex::new(Vec::new()));
schema.plugin(CountFields { paths: Arc::clone(&paths) });
# let _ = paths;
```

In production, prefer structured tracing over storing paths in memory. See
[Tracing](../plugins/tracing).

## Next

- [Using plugins](using-plugins)
- [Directives](../plugins/directives)
- [Scope auth](../plugins/scope-auth)
