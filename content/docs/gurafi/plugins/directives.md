---
title: "Directives"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/directives.md"
---

GraphQL directives add metadata to schema elements. `gurafi` supports custom directive
definitions and applications on types, fields, field arguments and input fields; the built-in
`@deprecated`, `@specifiedBy` and `@oneOf` directives are produced by their dedicated builder
options.

## Register a definition

A directive must be defined before it is applied. `gql::DirectiveDefinition` supplies the name,
description, locations, repeatability and arguments:

```rust
use gurafi::gql::{
    AppliedDirective, DirectiveDefinition, InputValue, TypeRef,
    ast::DirectiveLocation,
};

schema.directive(
    DirectiveDefinition::new("tag")
        .description("A documentation tag.")
        .location(DirectiveLocation::Object)
        .location(DirectiveLocation::FieldDefinition)
        .arg(InputValue::new("name", TypeRef::string().non_null())),
);
```

The definition is validated with the rest of the schema. A directive applied in a location it
does not declare is a build error, as is a wrong argument type or a non-repeatable duplicate.

## Apply to a type

```rust
schema.type_directive(
    "User",
    AppliedDirective::new("tag").argument("name", "identity"),
);
```

`type_directive` works for objects, interfaces, unions, scalars, enums, input objects and root
types. The type may be registered later; applications are recorded by name and attached during
`build`. A name that is never registered is a build error.

At the declaration site, use the builder method:

```rust
schema.object::<User>(|o| {
    o.directive(AppliedDirective::new("tag").argument("name", "identity"));
    // ...
});
```

Interfaces and unions have `directive(...)` too.

## Apply to a field

```rust
schema.object::<User>(|o| {
    o.field("name", |u: &User, _: NoArgs, _: &Ctx| u.name.clone())
        .directive(AppliedDirective::new("tag").argument("name", "public"));
});
```

`FieldConfig` covers object, root and subscription fields. `InterfaceFieldConfig` covers
interface fields; object fields that inherit an interface field also inherit its directives
unless the object declares its own.

## Apply to arguments and input fields

```rust
schema.argument_directive(
    "Query",
    "search",
    "filter",
    AppliedDirective::new("tag").argument("name", "input"),
);

schema.input_field_directive(
    "FilterInput",
    "prefix",
    AppliedDirective::new("tag").argument("name", "filter"),
);
```

`argument_directive` targets object, interface and root field arguments. It does not cover
arguments of a directive definition, which are configured directly on the `InputValue`.

## Repeatable directives

A repeatable directive may be applied more than once:

```rust
schema.directive(
    DirectiveDefinition::new("tag")
        .repeatable()
        .location(DirectiveLocation::FieldDefinition)
        .arg(InputValue::new("name", TypeRef::string())),
);

schema.object::<User>(|o| {
    o.field("name", |u: &User, _: NoArgs, _: &Ctx| u.name.clone())
        .directive(AppliedDirective::new("tag").argument("name", "public"))
        .directive(AppliedDirective::new("tag").argument("name", "searchable"));
});
```

Applications are kept in declaration order.

## Where directives appear

- `schema.sdl()` prints the definition and every application.
- `Schema::extend_sdl` and `Schema::merge` preserve definitions and applications.
- Standard GraphQL introspection exposes directive **definitions** (`__schema.directives`:
  name, description, locations, arguments, `isRepeatable`). The specification has no
  introspection field for applied directives, so use SDL or `gql::Field::directives` in a plugin
  to inspect applications.

Directives are metadata; they do not install resolvers or change execution semantics. If a
directive should enforce a rule, read it in a [plugin](../guide/writing-plugins) or in the
resolver. Built-in directives such as `@deprecated` affect introspection and SDL only.

## Built-in directives

Use the dedicated builder options rather than applying the directive manually:

```rust
o.field("old", |g: &Giraffe, _: NoArgs, _: &Ctx| g.old_name.clone())
    .deprecated("Use `name`.");

schema.scalar::<Date>(); // #[derive(Scalar)] #[graphql(specified_by = "...")]

#[derive(Input)]
#[graphql(name = "SearchBy", one_of)]
struct SearchBy { /* ... */ }
```

Those fields also print as `@deprecated`, `@specifiedBy` and `@oneOf` and are validated as
built-in applications.

## Derive attributes

Applying a custom directive through `#[graphql(directive = "...")]` is not supported. Builder
methods are explicit about reopening and repeatable applications. If a directive is attached in
one module, apply it from that module's registration function.

## Next

- [Writing plugins](../guide/writing-plugins)
- [Schema builder](../guide/schema-builder)
- [Add GraphQL](add-graphql)
