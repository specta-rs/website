---
title: "File layout"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/app-layout.md"
---

A schema can live in one file or be split across modules. `gurafi` is designed for the split
case: object, interface and root declarations reopen the same type, so a type's fields can be
co-located with the code that owns them.

## A small application

```text
src/
  main.rs
  context.rs
  schema.rs
  users/
    mod.rs
    model.rs
    queries.rs
    mutations.rs
  posts/
    mod.rs
    model.rs
    queries.rs
```

`main.rs` owns the server and calls `schema::build()`:

```rust
mod schema;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let schema = schema::build()?;
    // hand `schema` to suku
    # let _ = schema;
    Ok(())
}
```

`schema.rs` defines the context type and registers every module:

```rust
use gurafi::Schema;

pub struct Ctx {
    pub database: std::sync::Arc<Database>,
    pub current_user: Option<User>,
}

pub fn build() -> Result<gql::Schema, gurafi::SchemaError> {
    let mut schema = Schema::<Ctx>::new();
    schema.description("The application API.");

    crate::users::register(&mut schema);
    crate::posts::register(&mut schema);

    schema.build()
}
```

`users/mod.rs` registers the type and its root fields:

```rust
use gurafi::{NoArgs, Schema, expose};

pub fn register(schema: &mut Schema<crate::schema::Ctx>) {
    schema.object::<User>(|o| {
        o.expose(expose!(User::id));
        o.expose(expose!(User::name));
    });

    schema.object_fields::<User>(|o| {
        o.field("posts", |user: &User, args: PostArgs, ctx: &crate::schema::Ctx| {
            crate::posts::for_user(user, args, ctx)
        });
    });

    schema.query(|q| {
        q.field("viewer", |_: NoArgs, ctx: &crate::schema::Ctx| ctx.current_user.clone());
    });
}
```

`User::id` and `User::name` are declared in `users/model.rs`; the query in `users/queries.rs`;
the related field can live in `posts` because it references the same `User` type. Duplicate
field names are build errors, so the split cannot silently overwrite a field.

## Naming conventions

- `model.rs` — plain Rust data and `#[derive(Object)]` / `Input` / `Enum` definitions.
- `queries.rs`, `mutations.rs` — root field registration functions.
- `mod.rs` — `pub fn register(schema: &mut Schema<Ctx>)`.
- Keep the context type in one module and import it as `crate::schema::Ctx`.

There is no rule that a GraphQL type must be registered where its model is defined. Register it
once and reopen it from the modules that add fields.

## Reopening versus duplicate definitions

`object`, `object_fields` and `object_field` all add to the same type. The same is true for
`interface`, `query`, `mutation` and `subscription`. A duplicate field name is a build error, not
a last-writer-wins merge.

`#[derive(Object)]` should appear once per Rust type. Two different Rust models with the same
GraphQL name are a build error unless you explicitly use `object_ref` for a runtime name.

## Feature modules

Put cross-cutting extensions in a `plugins.rs` module:

```rust
pub fn install(schema: &mut Schema<Ctx>) {
    schema.plugin(gurafi::TracingPlugin::stderr());
}
```

Call it after registering types and before `build()`. Plugin order is registration order, so
install plugins before any module that depends on their metadata.

## Tests

Build a fresh schema per test with the same registration functions. `Schema` is `Clone`, so a
test can keep a declaration and build variants with different `BuildOptions` or plugins.

## Next

- [Objects](objects)
- [Using plugins](using-plugins)
- [Troubleshooting](troubleshooting)
