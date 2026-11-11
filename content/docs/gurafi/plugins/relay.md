---
title: "Relay"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/relay.md"
---

`gurafi-relay` adds the Relay conventions a code-first schema normally hand-writes:

- typed global IDs
- the shared `Node` interface and `node` / `nodes` root fields
- connections with cursors and `PageInfo`
- mutation payloads with `clientMutationId`

It is a thin layer over public `gurafi` APIs and has no async-runtime dependency.

```toml
[dependencies]
gurafi = "0.1.2"
gurafi-relay = "0.1.2"
```

## Global IDs

`GlobalId<T>` is an `ID!` scalar that encodes `Base64("TypeName:localId")`:

```rust
use gurafi_relay::GlobalId;

let id = GlobalId::<User>::new("42");
assert_eq!(id.encode(), "VXNlcjo0Mg==");
assert_eq!(GlobalId::<User>::decode(&id.encode())?.as_local(), "42");
```

The decode checks Base64, UTF-8, padding, the `TypeName:localId` shape and the type name. A
`User` ID cannot be passed where a `Post` ID is expected.

## Node

```rust
use gurafi::{Object, Schema, expose};
use gurafi_relay::Relay;

#[derive(Clone, Object)]
struct User {
    id: String,
    name: String,
}

struct Ctx;

let mut schema = Schema::<Ctx>::new();
let mut relay = Relay::<Ctx>::new();

relay.node::<User>(&mut schema, |n| {
    n.id(|user: &User| user.id.clone());
    n.load_one(|id, _ctx: &Ctx| {
        Box::pin(async move {
            Some(User { id, name: "Ada".into() })
        })
    });
})?;

schema.object::<User>(|o| {
    o.expose(expose!(User::name));
});
```

The first registration installs:

```graphql
interface Node { id: ID! }

type Query {
  node(id: ID!): Node
  nodes(ids: [ID!]!): [Node]!
}
```

Every later `node` call adds a type to the same dispatcher. The object implements `Node`; an
`id: ID!` field returning the encoded global ID is added unless the object already declares one.

Loaders:

- `load_one` / `load_one_result`
- `load_many` / `load_many_result`

If only one is supplied, the other is derived from it. The fallback from `load_many` to
`load_one` is bounded to avoid an unbounded fan-out from a large `nodes` request.

Request cache:

```rust
let relay = Relay::<Ctx>::new().with_request_cache(|ctx: &Ctx| ctx.cache.clone());
```

With an accessor, `node`/`nodes` cache results by type and local ID for the request. Without one,
`nodes` still deduplicates within a single call.

### Local IDs

Bare local IDs are rejected by default. For a migration period, opt in:

```rust
let relay = Relay::<Ctx>::new().allow_local_ids(true);
```

The fallback tries a value against every registered node loader, so a client can resolve a type
it did not name. Enable it only while clients still send local IDs. The setting is shared with
the installed root fields and can be changed after registration.

## Connections

Connection type names are explicit. Register the connection first, then attach it to a field.

```rust
use gurafi::{NoArgs, Object, Schema, expose};
use gurafi_relay::{Connection, ConnectionArgs, Relay};

#[derive(Clone, Object)]
struct User { id: String }

#[derive(Clone, Object)]
struct Post { id: String, title: String }

struct Ctx { posts: Vec<Post> }

let mut schema = Schema::<Ctx>::new();
let mut relay = Relay::<Ctx>::new();

schema.object::<User>(|o| { o.expose(expose!(User::id)); });
schema.object::<Post>(|o| { o.expose(expose!(Post::title)); });

relay.object_connection::<User, Post, _>(
    &mut schema,
    "posts",
    "UserPostsConnection",
    |_user: &User, args: ConnectionArgs, ctx: &Ctx| {
        Connection::from_slice(&ctx.posts, &args, |post: &Post| post.id.clone())
    },
)?;
```

This creates:

```graphql
type UserPostsConnection {
  edges: [UserPostsConnectionEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}

type UserPostsConnectionEdge {
  cursor: String!
  node: Post!
}
```

`Connection::from_slice` applies `first` / `after` / `last` / `before` with the Relay
`ApplyCursorsToEdges` rules and computes `hasNextPage` / `hasPreviousPage` from the filtered
window. `Connection::from_slice_by_index` uses the item index as an opaque cursor;
`Connection::empty()` starts an empty page.

`PageInfo` contains `hasNextPage`, `hasPreviousPage`, `startCursor` and `endCursor`. Cursors are
opaque Base64 strings by default. A cursor that is not in the list is an error rather than a
silent restart.

## Mutations

A Relay mutation generates `<Field>Payload` with a `result: T!` field and a configurable
`clientMutationId`:

```rust
use gurafi_relay::{ClientMutationId, MutationConfig};

relay.mutation_with::<Post, CreatePostInput, _>(
    &mut schema,
    "createPost",
    MutationConfig::new().client_mutation_id(ClientMutationId::Optional),
    |input, ctx| create_post(input, ctx),
)?;
```

The generated shape is:

```graphql
createPost(input: CreatePostInput!, clientMutationId: String): CreatePostPayload!

type CreatePostPayload {
  result: Post!
  clientMutationId: String
}
```

`ClientMutationId::Omit`, `Optional` and `Required` control presence. `T = Option<Post>` makes
`result` nullable. Async variants are available with `mutation_async_with`; `mutation` is the
sync convenience form.

Relay's `commitMutation` normally sends `clientMutationId` inside `variables.input`. Here it is a
sibling argument because `gurafi` input object names are compile-time constants. The response
shape matches Relay; a client that requires the field inside the input object is not
wire-compatible.

## Security and limits

- Global IDs are the default; local IDs must be opted in.
- Unknown global type IDs in `nodes` produce a null item, not a null response.
- Node loader errors are cached for the request, so a failing backend is not retried per field.
- `nodes` with only `load_one` runs bounded concurrent loads.
- Request-scoped caching is opt-in through `with_request_cache`.

## Next

- [Schema builder](../guide/schema-builder)
- [Dataloaders](dataloader)
- [Typed errors](errors)
