---
title: "Using GraphiQL"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/playground.md"
---

`suku` serves a GraphiQL page when the transport enables it. It is the quickest way to explore a
schema, run introspection and test arguments while the server is running.

```rust
use suku::{Context, Server};

let app = suku::axum::GraphQL::new(Server::new(schema))
    .path("/graphql")
    .graphiql(true)
    .with_context(|_| async { Ok::<_, suku::http::HttpError>(Context::empty()) })
    .into_router();
```

Start the server and open `http://127.0.0.1:3000/graphql`. The editor sends requests to the same
path; a GET request with an HTML `Accept` header returns the GraphiQL page, while a POST runs the
operation.

## Offline and air-gapped deployments

By default the page loads pinned React, ReactDOM and GraphiQL bundles from unpkg. In an air-gapped environment, or
when a content security policy must not allow a CDN, enable the `vendored-graphiql` feature:

```toml
[dependencies]
suku = { version = "0.1.0", features = ["vendored-graphiql"] }
```

The pinned browser bundles are compiled into the crate and inlined into a single HTML response, so
there are no asset routes and the page makes no requests except to the GraphQL endpoint it came
from. To keep the CSP strict, allow inline script and style (or their hashes) and keep
`connect-src 'self'`; the stylesheet embeds fonts as `data:` URIs, so no font host is needed. The
default build is unchanged and remains CDN-backed. See
[GraphiQL assets](../server/suku#graphiql) for the update procedure.

## Headers and authentication

GraphiQL lets you set request headers. Use them for `Authorization` or a development token. The
context extractor from the [context guide](context) sees the same headers as any other client.

## Introspection

Introspection is enabled by default on `suku::Server`; disable it in production if the schema
should not be public:

```rust
let server = Server::new(schema).introspection(false);
```

GraphiQL still opens, but introspection queries return the usual disabled response.

## Limits and errors

The page is a normal HTTP client. Server limits (`max_depth`, `max_complexity`, `max_errors`,
body size and timeouts) and field authorization apply exactly as they do to application traffic.
An error response is shown in GraphiQL's result pane.

## Playground versus tests

GraphiQL is for exploration. Keep executable tests in Rust:

```rust
let response = gql::execute(
    &schema,
    gql::Request::new("{ giraffe { name } }"),
    &gql::ExecutionOptions::default(),
).await;
assert!(response.errors.is_empty());
```

See [Testing patterns](troubleshooting#testing).

## Next

- [Serving over HTTP](../server/suku)
- [Printing schemas](printing-schemas)
