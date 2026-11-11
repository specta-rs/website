---
title: "Circular references"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/circular-references.md"
---

GraphQL types can refer to each other. `gql` resolves type references by name at build time, so a
field may return a type registered later. Rust still needs a finite layout, which is where
`Box` and `Arc` come in.

## Output cycles

If two models contain each other, box one side:

```rust
use gurafi::Object;

#[derive(Object)]
struct User {
    id: String,
    posts: Vec<Post>,
}

#[derive(Object)]
struct Post {
    id: String,
    author: Box<User>,
}
```

`Box<T>` implements `OutputType` by forwarding to `T`, so `author` is still the `User!` GraphQL
type. `Arc<T>` works the same way when the model is shared:

```rust
use std::sync::Arc;

#[derive(Object)]
struct Post {
    id: String,
    author: Arc<User>,
}
```

The GraphQL schema does not need to know which side is boxed. It only sees `User` and `Post`.

## Registration order

Register both types before building:

```rust
schema.object::<User>(|o| {
    o.expose(gurafi::expose!(User::id));
    o.field("posts", |u: &User, _: NoArgs, _: &Ctx| u.posts.clone());
});

schema.object::<Post>(|o| {
    o.expose(gurafi::expose!(Post::id));
    o.field("author", |p: &Post, _: NoArgs, _: &Ctx| (*p.author).clone());
});
```

`payload.author` is typed as `User!` even if `User` was registered first. A field that names a
type which is never registered is a build error.

## Recursive input objects

Input cycles are legal when they are finite at runtime, but Rust still needs an indirection:

```rust
#[derive(gurafi::Input)]
#[graphql(name = "FilterInput")]
struct Filter {
    name: Option<String>,
    nested: Option<Box<Filter>>,
}
```

The schema build rejects an input cycle that cannot terminate (a required field that contains
itself). Optional/Boxed recursion is accepted.

## Abstract cycles

An interface or union can refer to object types that themselves return the abstract type:

```rust
let node = schema.interface("Node", |i| { i.field::<gurafi::ID>("id"); });

schema.object::<User>(|o| {
    o.implements(&node);
    o.field("friends", |u: &User, _: NoArgs, _: &Ctx| u.friends.clone())
        .as_abstract(&node);
});
```

The field declares the abstract return type with `as_abstract`; the concrete values are models.
The executor uses `is_type_of` (or an explicit `resolve_type`) to select the type per value.

## Avoid unbounded runtime recursion

A GraphQL query can nest a recursive type deeply. `gql` enforces parser depth and execution depth
limits and returns an error instead of overflowing the stack. Configure limits on the server:

```rust
let server = suku::Server::new(schema).max_depth(15);
```

See [Troubleshooting](troubleshooting#deep-queries).

## Next

- [Objects](objects)
- [Input objects](inputs)
- [Interfaces](interfaces)
