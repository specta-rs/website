---
title: "Interfaces"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/interfaces.md"
---

An interface declares fields that several object types share. Clients can select the interface
and use inline fragments for concrete fields.

Backing models stay concrete. The executor asks the object type's generated `is_type_of` check
(or the interface's `resolve_type` hook) which GraphQL type a value belongs to.

## Define an interface

```rust
use gurafi::{ID, NoArgs, Object, Schema, expose};

let node = schema.interface("Node", |i| {
    i.description("Anything with an id.")
        .field::<ID>("id");
});
```

Interface fields have no resolvers. Execution uses the concrete object's field resolver.

## Implement it

```rust
#[derive(Object)]
struct User {
    id: String,
    name: String,
}

schema.object::<User>(|o| {
    o.implements(&node);
    o.expose(expose!(User::name));
    o.field("id", |u: &User, _: NoArgs, _: &Ctx| ID::new(u.id.clone()));
});
```

`implements` is idempotent and also accepts a runtime `InterfaceRef`. An object may implement
several interfaces.

Interface fields can be declared once and inherited by the object:

```rust
schema.object::<User>(|o| {
    o.implements(&node);
    o.resolve_inherited("id", |u: &User, _: NoArgs, _: &Ctx| ID::new(u.id.clone()));
});
```

At build time the matching interface field supplies the type, arguments, description,
deprecation reason and directives when the object type did not set them. The build verifies that
the resolver's argument type matches the interface declaration.

Interfaces can implement other interfaces:

```rust
let resource = schema.interface("Resource", |i| {
    i.implements(&node);
    i.field::<String>("url");
});
```

An object type that implements `Resource` also implements `Node`; there is no need to repeat the
transitive interface.

## Abstract fields

A field returning an interface or union declares its abstract type with `as_abstract`:

```rust
schema.query(|q| {
    q.field("node", |args: NodeArgs, ctx: &Ctx| find_node(args, ctx))
        .as_abstract(&node);
});
```

For a runtime interface name, use `interface_ref` and the same method:

```rust
let node = schema.interface_ref("Node");
schema.implement_interface(&node, |i| {
    i.field::<ID>("id");
});

q.field_ref_type::<User, NoArgs, _>(node.type_ref(), "node", |_, _| current_user())
    .as_abstract(&node);
```

## Resolving the concrete type

The generated `ObjectModel` implementation supplies `is_type_of`, so a backing model that travels
as `Value::External` is recognised without extra code. Install `resolve_type` when the value is
not a Rust model, for example a raw map or an enum-shaped DTO:

```rust
let node = schema.interface("Node", |i| {
    i.field::<ID>("id");
    i.resolve_type(|value, _execution| {
        let typename = value.as_object()
            .and_then(|object| object.get("__typename"))
            .and_then(gql::Value::as_str)
            .ok_or_else(|| gql::GraphQLError::new("missing __typename"))?;
        Ok(gql::Name::from(typename))
    });
});
```

`resolve_type` returns a GraphQL type name. It runs before field completion for an abstract
position and its error becomes a field error.

## Authorization

Interface rules are inherited by implementing objects and their fields:

```rust
let node = schema.interface("Node", |i| {
    i.auth(|ctx: &Ctx| ctx.user.is_some())
        .auth_error("Sign in to read nodes");
    i.field::<ID>("id");
});
```

All applicable rules must allow the request: the object type's own rule, the field's rule, and every
implemented interface's rule. See [Scope auth](../plugins/scope-auth).

## Possible types

For a built schema, use the reference helpers:

```rust
let name = node.possible_types(&schema);     // Vec<Name>
assert!(node.is_possible_type(&schema, "User"));
```

These answer the same question as the built schema's abstract type map and are useful in code
that constructs fragments or client metadata.

## Next

- [Unions](unions)
- [Runtime-named types](schema-builder#runtime-named-types)
- [Scope auth](../plugins/scope-auth)
