---
title: "Using context"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/context.md"
---

The context is a value created for one request and shared by every resolver in that execution.
Typical contents are the signed-in user, an authorization token, database handles and
request-scoped caches.

In Rust the context is a type parameter on the schema. There is no ambient `context: any`; the
compiler checks every resolver against `Ctx`.

## Define the context

```rust
use gurafi::{NoArgs, Object, Schema, expose};

struct User {
    id: String,
    username: String,
}

struct AppContext {
    current_user: Option<User>,
}
```

Use the context in an object type:

```rust
#[derive(Object)]
struct Viewer {
    id: gurafi::ID,
    username: String,
}

let mut schema = Schema::<AppContext>::new();

schema.object::<Viewer>(|o| {
    o.expose(expose!(Viewer::id));
    o.expose(expose!(Viewer::username));
});

schema.query(|q| {
    q.field("viewer", |_: NoArgs, ctx: &AppContext| {
        ctx.current_user.as_ref().map(|user| Viewer {
            id: gurafi::ID::new(user.id.clone()),
            username: user.username.clone(),
        })
    });
});
```

`Option<Viewer>` makes the field nullable, so a signed-out response is
`{ "data": { "viewer": null } }`.

## Create the context in `suku`

The HTTP layer builds the context before executing the request:

```rust
use suku::{Context, Server, http::{ContextRequest, HttpError}};

let graphql = suku::axum::GraphQL::new(Server::new(schema))
    .with_context(|request: ContextRequest| async move {
        let user = authenticate(request.header("authorization")).await?;
        Ok::<_, HttpError>(Context::new(AppContext { current_user: user }))
    });
```

`authenticate` is application code. Returning `Err(HttpError)` rejects the request before GraphQL
execution; returning `Ok` makes the value available to every resolver.

`Context` is `suku`'s type-erased container. `Context::new(value)` stores your `AppContext`.
`gql::execute` receives it through `ExecutionOptions::with_context(...)`.

## Resolver shapes

Every resolver variant receives `&Ctx` at the end. Async resolvers use `Box::pin` because the
future borrows the context for its lifetime:

```rust
q.field_result_async("user", |args: UserArgs, ctx: &Ctx| {
    Box::pin(async move {
        let user = ctx.database.find_user(args.id).await?;
        Ok(user)
    })
});
```

The future must be `Send + 'static` where the schema requires it. Avoid holding a lock or a
borrowed reference across an `await` unless the resulting future satisfies those bounds.

## Request-scoped caches and loaders

Put request-scoped data in the context so it is dropped with the request:

```rust
use gurafi::{Loader, RequestCache};

struct Ctx {
    users: Loader<gurafi::ID, User>,
    cache: RequestCache,
}

fn context_for_request() -> Ctx {
    let cache = RequestCache::new();
    let users = cache.get_or_insert_with(|| {
        Loader::<gurafi::ID, User>::new(|ids| async move {
            load_users(ids).await
        })
    });

    Ctx {
        users: (*users).clone(),
        cache,
    }
}
```

`RequestCache` is shared and type-indexed. `Loader` batches and caches per request. Neither
survives the request, so results cannot leak between users. See
[Dataloaders](../plugins/dataloader).

## Multiple protocols

If HTTP and WebSocket handlers provide different context data, use an enum and match on the
transport inside resolvers:

```rust
enum Ctx {
    Http { request_id: String, user: Option<User> },
    WebSocket { connection_id: String, user: Option<User> },
}
```

Rust's exhaustive matching keeps each branch honest; there is no optional property that silently
becomes `undefined`.

## Cold-start and shared state

The context is per request. For application-wide state, put an `Arc` in the context:

```rust
#[derive(Clone)]
struct AppContext {
    database: Arc<Database>,
    current_user: Option<User>,
}
```

Cloning an `Arc` is cheap. The schema itself is immutable after `build()` and can be shared across
threads and requests.

## Next

- [Dataloaders](../plugins/dataloader)
- [Scope auth](../plugins/scope-auth)
- [Serving over HTTP](../server/suku)
