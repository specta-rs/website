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
