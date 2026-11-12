---
title: "Patterns"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/patterns.md"
---

Common ways to organise resolvers, context and data access. These are application patterns, not
framework requirements.

## Thin resolvers, typed services

Keep GraphQL concerns in the schema and business logic in plain Rust:

```rust
impl Ctx {
    async fn user(&self, id: &str) -> Result<Option<User>, gql::GraphQLError> {
        self.users.find(id).await.map_err(Into::into)
    }
}

schema.object::<User>(|o| {
    o.expose(gurafi::expose!(User::id));
    o.expose(gurafi::expose!(User::name));
});

schema.query(|q| {
    q.field_result_async("user", |args: UserArgs, ctx: &Ctx| {
        Box::pin(async move {
            Ok(ctx.user(&args.id).await?)
        })
    });
});
```

The resolver's job is to call the service, map its error and return the backing model.
Authorization, argument validation and type conversion are already handled by the builder.

## Loaders for related data

Use a loader in the context when a list of parents each need the same child query. Do not issue
one query per parent from a field resolver:

```rust
schema.object::<Post>(|o| {
    o.field_result_async("author", |post: &Post, _: NoArgs, ctx: &Ctx| {
        let users = ctx.users.clone();
        let author_id = post.author_id.clone();
        Box::pin(async move {
            users.load(author_id).await
        })
    });
});
```

`Loader` batches sibling loads and caches duplicates per request. See
[Dataloaders](../plugins/dataloader).

## Pagination

Return a plain list with `first`/`offset` arguments for simple APIs. Use Relay connections when a
client expects cursor pagination and `PageInfo`:

```rust
relay.object_connection::<User, Post, _>(
    &mut schema,
    "posts",
    "UserPostsConnection",
    |user: &User, args: ConnectionArgs, ctx: &Ctx| {
        Connection::from_slice(&ctx.posts_for(user), &args, |post| post.id.clone())
    },
)?;
```

See [Relay](../plugins/relay).

## Prebuilt values

When a resolver already has a complete GraphQL-shaped value — cached JSON, a database row
serialised once, an upstream response — use `Raw<T>` instead of installing a resolver for every
field:

```rust
use gurafi::{NoArgs, Raw, RawObject, Schema};

schema.object::<Giraffe>(|o| {
    o.raw_field::<String>("name");
    o.raw_field::<f64>("height");
});

schema.query(|q| {
    q.field("giraffe", |_: NoArgs, _: &Ctx| {
        Raw::<Giraffe>::object(
            RawObject::new()
                .field("name", "Melman")
                .field("height", 5.2)
                .build(),
        )
    });
});
```

`Raw<T>` derives its GraphQL type from `T`, so the compiler still checks list and nullability
wrappers. It bypasses per-field resolvers, so every selected field must be declared with
`raw_field`/`raw_field_with`; mixing raw and resolver-backed fields on one object is a build
error. Do not use it to skip a domain model that a resolver needs.

`RawObject` strips internal keys and can carry `__typename`. For untrusted JSON, preserve or
overwrite `__typename` deliberately; a raw value must not choose its own abstract type unless
that is safe for the endpoint. See [Prebuilt values](#prebuilt-values) and the raw-value
tradeoffs in the crate docs.

## Errors as data

Use `field_result_union` when an expected failure is part of the API (not found, conflict,
validation) and should be selectable by the client:

```rust
m.field_result_union::<User, CreateUserError, CreateUserArgs, _>(
    "createUser",
    |args: CreateUserArgs, ctx: &Ctx| create_user(args, ctx),
);
```

Use `field_result` for an unexpected failure that should become a GraphQL error. See
[Typed errors](../plugins/errors) and [Error masking](../server/suku#error-formatting-and-masking).

## Feature flags and environment

Keep environment-specific wiring outside the schema:

```rust
if std::env::var("GRAPHQL_MOCKS").as_deref() == Ok("1") {
    schema.plugin(gurafi::MockPlugin::new().mock("Query.viewer", viewer_fixture()));
}
```

The schema is assembled at startup; plugins and mocks do not add per-request branches.

## Next

- [Dataloaders](../plugins/dataloader)
- [Complexity](../plugins/complexity)
- [Typed errors](../plugins/errors)
- [Relay](../plugins/relay)
