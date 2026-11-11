---
title: "Dataloaders and request cache"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/dataloader.md"
---

A `Loader` solves the N+1 query problem. Resolvers ask for a key; loads issued in the same
executor round are collected into one batch call, duplicate keys share a read, and results are
cached for the request.

The loader lives in the request context, alongside a `RequestCache`. Neither survives the
request, so results cannot leak between users.

## Define the context

```rust
use gurafi::{ID, Loader, RequestCache, Object, expose};

#[derive(Clone, Object)]
struct User {
    id: ID,
    name: String,
}

struct Ctx {
    users: Loader<ID, User>,
    cache: RequestCache,
}

impl Ctx {
    fn new(database: std::sync::Arc<Database>) -> Self {
        let cache = RequestCache::new();

        let users = cache.get_or_insert_with(|| {
            let database = std::sync::Arc::clone(&database);
            Loader::<ID, User>::new(move |ids: Vec<ID>| {
                let database = std::sync::Arc::clone(&database);
                async move {
                    database.users_by_ids(ids).await
                }
            })
        });

        Self {
            users: (*users).clone(),
            cache,
        }
    }
}
```

`RequestCache::get_or_insert_with` initialises a typed value once even under concurrent resolver
access. `Loader` is cheap to clone: every clone shares the queue, batches and cache.

## Use it in a resolver

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

When several posts are completed in the same round, their `load` calls share one batch. The
executor resolves sibling fields concurrently; list items are completed one at a time, so a list
of children does not batch through per-item calls. Load the children in the parent resolver with
`load_many` when you know the full list:

```rust
q.field_result_async("posts", |user: &User, _: NoArgs, ctx: &Ctx| {
    let ids = user.post_ids.clone();
    let posts = ctx.posts.clone();
    Box::pin(async move {
        posts.load_many(ids).await.into_iter().collect()
    })
});
```

## Caching and errors

- A resolved value is cached for the loader's lifetime (the request).
- In-flight duplicate keys join the same read.
- Errors are cached too; a failing backend is not retried once per selected field.
- `prime(key, value)` seeds a value you already have.
- `clear_key(&key)` and `clear()` forget cached values after a mutation.
- `is_cached`, `cached_len` inspect the cache.

Cache semantics are per loader instance. Create a fresh loader per request; do not put one in a
global.

## Batching semantics

The batch window is one executor yield, not wall-clock time:

- A load queues its key on first poll and yields once.
- Every key queued before the next poll shares a batch.
- `load(a).await` followed by `load(b).await` in one resolver does **not** batch; use
  `load_many` for that.
- There is no timer, background task or runtime dependency. It works under Tokio, `futures`,
  `async-std` and a hand-written executor.

## Limits

```rust
use gurafi::{LoaderConfig, Loader};

let loader = Loader::with_config(batch_fn, LoaderConfig::new()
    .with_max_batch_size(500)
    .with_max_queue(5_000)
    .with_max_attempts(3));
```

`max_batch_size` splits a large queue into concurrent batches. `max_queue` forces an early flush
so memory does not grow without bound while a request is stalled. `max_attempts` retries a key
the batch function omitted; a correct batch function returns exactly one result per key.

The batch function must not load a key that belongs to its own batch. That load can never be
satisfied before the batch finishes.

## Fallible batches

`Loader::new_fallible` accepts a batch function that reports a whole-batch error:

```rust
let loader = Loader::<ID, User, gql::GraphQLError>::new_fallible(|ids| async move {
    let result = database.users_by_ids(ids).await?;
    Ok(result)
});
```

The whole-batch error is cloned to every key in that batch; no waiter is left stranded.

## Request cache without a loader

Use `RequestCache` for any per-request value:

```rust
struct Ctx { cache: RequestCache }

let permissions = ctx.cache.get_or_insert_with(|| load_permissions(&ctx.user));
```

Use `get::<T>()`, `insert::<T>(value)`, `remove::<T>()`, `contains::<T>()`, `clear()` and `len()`.
The cache is type-indexed and `Send + Sync`; separate `RequestCache::new()` calls are isolated.

## Inspecting batches

With the `tracing` feature, `gurafi.loader.batch` records queue length, batch size, deduplicated
keys, duration and errors. See [Tracing](tracing).

## Next

- [Context](../guide/context)
- [Tracing](tracing)
- [Patterns](../guide/patterns)
