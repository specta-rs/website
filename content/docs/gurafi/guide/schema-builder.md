---
title: "Schema builder"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/schema-builder.md"
---

`gurafi::Schema<Ctx>` collects object, interface, union, scalar and root declarations and turns
them into a `gql::Schema`. Configuration and type registration happen once, then `build()`
freezes the result.

## Creating a schema

```rust
use gurafi::Schema;

struct Ctx;

let mut schema = Schema::<Ctx>::new();
```

`Ctx` is the request context type. Use `()` when the schema does not need one.

The builder exposes:

```rust
schema.description("The zoo API.");
schema.query_name("RootQuery");
schema.mutation_name("RootMutation");
schema.subscription_name("RootSubscription");
```

## Building

```rust
let schema: gql::Schema = schema.build().expect("valid schema");
```

`build()` validates everything `gql` requires: duplicate names, dangling type references,
invalid interface implementations, input cycles, directive locations and argument types. It
returns every problem together as `SchemaError`.

For stable snapshots and generated clients, sort types by name:

```rust
use gurafi::BuildOptions;

let options = BuildOptions::new()
    .query_description("Everything readable.")
    .mutation_description("Everything writable.")
    .sort_types(true);

let schema = schema.build_with(options)?;
```

`Schema` is `Clone`. Keep the declaration after building, or build repeatedly:

```rust
let first = schema.build_clone()?;
let second = schema.clone().build_with(BuildOptions::new().sort_types(true))?;
```

## Registering types

```rust
schema.object::<User>(|o| { /* fields */ });
schema.object_ref::<User>("AdminUser");
schema.interface("Node", |i| { i.field::<gurafi::ID>("id"); });
schema.interface_ref("Named");
schema.union("SearchResult", |u| { u.member::<User>(); });
schema.union_ref("SearchResult");
schema.scalar::<Date>();
schema.enum_type::<Color>();
```

Named types referenced by a field are registered automatically. Explicit registration is useful
for types that are part of the public schema without appearing in a field signature, and for
choosing a registration order when `sort_types` is off.

## Plugins

```rust
schema.plugin(gurafi::TracingPlugin::stderr());
```

Plugins are build-time field hooks. They see every object, interface, root and subscription
field, can mutate field metadata, and can wrap resolvers and subscriptions. See
[Using plugins](using-plugins) and [Writing plugins](writing-plugins).

## Runtime-named types

Most GraphQL names are known from the Rust type. A reference separates the name from the backing
model:

```rust
let admin = schema.object_ref::<User>("AdminUser");
schema.implement(&admin, |o| {
    o.expose(gurafi::expose!(User::name));
});

let node = schema.interface_ref("Node");
schema.implement_interface(&node, |i| { i.field::<gurafi::ID>("id"); });

let search = schema.union_ref("SearchResult");
schema.implement_union(&search, |u| { u.member::<User>(); });
```

`ObjectRef<M>`, `InterfaceRef` and `UnionRef` are `Clone` but not `Copy`. The same GraphQL name
and backing model merge; a different backing model claiming a name is a build error. Runtime names
must match the GraphQL `Name` grammar; an invalid name is a build error.

Return a runtime-named object:

```rust
q.field_ref(&admin, "admin", |_: NoArgs, _: &Ctx| current_admin());
```

Use an explicit type reference when the field is abstract or the wrappers need to be spelled out:

```rust
q.field_ref_type::<Vec<User>, NoArgs, _>(
    admin.type_ref().non_null().list().non_null(),
    "admins",
    |_: NoArgs, _: &Ctx| all_admins(),
);
```

`field_ref_type` checks that the wrappers are truthful for the Rust type and that the named type
exists. `FieldConfig::as_dynamic(TypeRef)` is the same operation on a field whose builder is not
available.

## Directives

Register a definition once and apply it where it belongs:

```rust
use gurafi::gql::{AppliedDirective, DirectiveDefinition, ast::DirectiveLocation, InputValue, TypeRef};

schema.directive(
    DirectiveDefinition::new("tag")
        .description("A documentation tag.")
        .location(DirectiveLocation::Object)
        .location(DirectiveLocation::FieldDefinition)
        .arg(InputValue::new("name", TypeRef::string())),
);

schema.type_directive(
    "User",
    AppliedDirective::new("tag").argument("name", "identity"),
);

schema.object::<User>(|o| {
    o.field("name", |u: &User, _: NoArgs, _: &Ctx| u.name.clone())
        .directive(AppliedDirective::new("tag").argument("name", "public"));
});
```

`type_directive` works for objects, interfaces, unions, scalars, enums, input objects and root
types, including types registered later. `argument_directive` and `input_field_directive` cover
the remaining positions. See [Directives](../plugins/directives).

## Generated types

Error result unions register generated success objects and result unions from the parent type and
field name. Relay connections and payloads use runtime names. Both are ordinary schema types at
build time; `Schema::build` validates them like hand-written declarations.

## Introspection and SDL

```rust
let sdl = schema.sdl();
let diff = gql::diff(&old_schema, &new_schema);
```

The returned schema is a `gql::Schema`, so introspection, execution and `suku` need no
`gurafi`-specific adapter. See [Printing schemas](printing-schemas).

## Next

- [Objects](objects)
- [Using plugins](using-plugins)
- [Printing schemas](printing-schemas)
