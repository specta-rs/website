---
title: "Unions"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/unions.md"
---

A union is an abstract output type whose members are object types. Unlike an interface, a union
does not declare shared fields; clients select every field with an inline fragment.

## Define a union

Use `#[derive(Union)]` on an enum whose variants each hold one backing model:

```rust
use gurafi::{Object, Union};

#[derive(Object)]
struct User {
    name: String,
}

#[derive(Object)]
struct Post {
    title: String,
}

#[derive(Union)]
enum SearchResult {
    User(User),
    Post(Post),
}
```

Register the union on the schema:

```rust
let search = schema.union("SearchResult", |u| {
    u.member::<User>().member::<Post>();
});
```

`#[derive(Union)]` knows the member backing models, which is how it can convert the Rust enum to a
GraphQL value. `schema.union` records the GraphQL member list and any description or directives.

## Return a union

```rust
schema.query(|q| {
    q.field("search", |args: SearchArgs, ctx: &Ctx| search_results(args, ctx))
        .as_abstract(&search);
});
```

The resolver returns `SearchResult`. At execution time the active variant's backing model travels
through the executor as `Value::External`, and the object type's `is_type_of` check selects the
concrete type. A union may therefore contain backing models that also implement interfaces.

`member::<M>()` records a reference to `M`; forgetting `schema.object::<M>(...)` is reported at
build time with the missing type name.

## Querying

```graphql
query {
  search {
    __typename
    ... on User { name }
    ... on Post { title }
  }
}
```

A field of a union type has no direct scalar fields; `__typename` and fragments are the way to
read members.

## Resolving a custom value

When the value is not a Rust model, install `resolve_type` on the union:

```rust
let search = schema.union("SearchResult", |u| {
    u.member::<User>().member::<Post>();
    u.resolve_type(|value, _execution| {
        let object = value.as_object()
            .ok_or_else(|| gql::GraphQLError::new("expected an object"))?;
        let typename = object.get("__typename")
            .and_then(gql::Value::as_str)
            .ok_or_else(|| gql::GraphQLError::new("missing __typename"))?;
        Ok(gql::Name::from(typename))
    });
});
```

`resolve_type` wins over per-object `is_type_of` checks. It must return a member type name.

## Runtime-named unions

For a union name computed at runtime, use `union_ref` and `implement_union`:

```rust
let search = schema.union_ref("SearchResult");
schema.implement_union(&search, |u| {
    u.member::<User>().member::<Post>();
});

q.field_ref_type::<SearchResult, NoArgs, _>(search.type_ref(), "search", |_, _| {
    SearchResult::User(current_user())
})
.as_abstract(&search);
```

`field_ref_type` uses the Rust enum's `OutputType` for wrappers and the runtime name for the
GraphQL type. `as_abstract` then tells the executor the value is abstract.

## Description and derivation

```rust
#[derive(Union)]
#[graphql(name = "SearchResult", description = "A user or a post.")]
enum Search {
    User(User),
    Post(Post),
}
```

The derived name is used by `OutputType`; `schema.union` should use the same name. If the union is
declared with a different runtime name, use `field_ref_type` rather than assuming the derived
name.

## Rules

- Every variant holds exactly one backing model (`User(User)`).
- No generic enums.
- The same backing model cannot appear in two variants.
- Union members are object types only.
- A union cannot appear in an input position.

## Next

- [Interfaces](interfaces)
- [Relay](../plugins/relay)
- [Runtime-named types](schema-builder#runtime-named-types)
