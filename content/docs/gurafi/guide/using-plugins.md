---
title: "Using plugins"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/using-plugins.md"
---

Plugins are build-time extensions. A plugin sees every field once while the schema is assembled
and can change metadata, wrap resolvers or subscriptions, or add schema configuration. There is no
per-request iteration over plugins and no dynamic type system.

Register a plugin on the builder:

```rust
use gurafi::{Schema, TracingPlugin};

let mut schema = Schema::<Ctx>::new();
schema.plugin(TracingPlugin::stderr());
schema.query(|q| {
    q.field("ok", |_: gurafi::NoArgs, _: &Ctx| true);
});
```

Plugins run once during `build()`, `build_with()` or `build_clone()`.

## Coverage

Every field declared through the builders is visited:

- object, interface, query, mutation and subscription fields
- fields on reopened types and types declared in another module
- runtime-named objects and interfaces (`object_ref` / `interface_ref`)
- raw fields (`raw_field`)
- generated result-union success fields
- root fields created by Relay helpers

Interface fields have no resolvers, so only the metadata hook runs for them.

Registering a plugin before or after a field is equivalent. A `build_clone` applies plugins to
the clone, so building repeatedly does not stack wrappers.

## Ordering

Plugins run in registration order. Wrappers compose with the first registered plugin outermost:

```text
first:before
  second:before
    resolver
  second:after
first:after
```

For a field's final metadata, each plugin sees the previous plugin's changes.

## Built-in plugins

| Plugin | Purpose |
| --- | --- |
| `TracingPlugin` | field start/finish callbacks, no `tracing` dependency |
| `ResponseExtensionPlugin` | write a response extension from a resolver wrapper |
| `MockPlugin` | replace exact `Type.field` resolvers for tests |

See [Tracing](../plugins/tracing), [Mocks](../plugins/mocks) and
[Writing plugins](writing-plugins).

## Authorization and validation

Field-level `.auth(...)` is installed when a field is declared, before plugins. A wrapping plugin
that calls `next` preserves it. A plugin that replaces the resolver — such as `MockPlugin` —
bypasses field auth, argument validation and the original resolver.

Object- and interface-level authorization is installed after plugins, so it always runs outside
the plugin chain and cannot be bypassed by a mock.

Argument validation is part of the resolvers that wrapping plugins call. A plugin that calls
`next` therefore runs validation exactly once; replacing the resolver skips it.

## Schema configuration

`Plugin::configure` runs once after every type and root is registered. Use it for
schema-level directives or extra types:

```rust
use gurafi::{FieldMeta, Plugin, gql::SchemaBuilder};

struct AddSchemaDirective;

impl Plugin<Ctx> for AddSchemaDirective {
    fn configure(&self, builder: &mut SchemaBuilder) {
        // Register a directive definition, add an SDL extension, etc.
    }

    fn field(&self, _meta: &FieldMeta<'_>, _field: &mut gql::Field) {}
}
```

Types added directly by `configure` are not visited by the field hooks because they did not come
through the `Schema` builders.

## Cost

With no plugins, the builder returns immediately and execution is unchanged. A metadata-only
plugin leaves resolver-less raw fields on the executor's leaf fast path. A plugin that wraps a
field installs the wrapper; ordinary resolver cost then applies.

## Next

- [Writing plugins](writing-plugins)
- [Tracing](../plugins/tracing)
- [Mocks](../plugins/mocks)
- [Scope auth](../plugins/scope-auth)
