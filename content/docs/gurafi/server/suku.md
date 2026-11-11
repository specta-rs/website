---
title: "suku"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/server/suku.md"
---

`suku` is the HTTP server crate for [gurafi](https://github.com/specta-rs/gurafi/blob/main/README.md). It takes a `gql::Schema` and exposes
it over HTTP according to the [GraphQL over HTTP](https://graphql.github.io/graphql-over-http/)
draft, without depending on `gurafi` or any high-level schema builder.

## Design

The crate is split into three layers so that HTTP frameworks never leak into execution:

1. **`Server`** — owns the schema and per-operation defaults. `execute`, `execute_batch` and
   `subscribe` return `gql` values only.
2. **`suku::http`** — a single `handle` function that receives `http::request::Parts`, the body
   bytes and a context extractor. It produces either a buffered `HttpResponse` or an `SseResponse`
   with a byte stream. It has no dependency on Axum, Tokio or a socket.
3. **`suku::axum`** — a builder that turns a `Server` into an `axum::Router`, reads the body with a
   limit and adapts `HttpResult` to an Axum response.

This is also why `suku` can be tested without a live server: the transport tests call `handle`
directly, and the Axum tests use `tower::ServiceExt::oneshot`.

## Building a server

```rust no_run
use suku::Server;

# fn build(schema: gql::Schema) {
let server = Server::new(schema)
    .introspection(true)
    .max_depth(15)
    .max_complexity(1_000)
    .max_errors(50)
    .max_body_bytes(512 * 1024)
    .max_batch_size(10)
    .batch_concurrency(8);
# let _ = server;
# }
```

| Option | Default | Meaning |
| --- | --- | --- |
| `introspection` | `true` | Allow `__schema` and `__type`. |
| `max_depth` | `32` | Maximum selection-set depth (parser hard cap is 96). |
| `max_complexity` | `100_000` | Maximum estimated operation cost. |
| `max_breadth` | `1_000` | Maximum distinct response keys in one selection set. |
| `max_errors` | `100` | Errors reported before execution stops adding them. |
| `max_body_bytes` | 1 MiB | HTTP body limit; `0` disables it. |
| `timeout` | `30s` | Wall-clock timeout for one operation or subscription setup. |
| `max_concurrency` | `16` | Sibling fields resolved concurrently per operation; `0` is unlimited. Mutations stay serial. |
| `max_batch_size` | `16` | Maximum operations in a batch; `0` disables it. |
| `batch_concurrency` | `16` | Operations executed concurrently in a batch. |

`Server` clones cheaply (one `Arc`), so it can be mounted in several routers or shared with
`Arc<Server>` without changing behaviour.

## Executing

```rust no_run
use suku::{Context, GraphQLRequest, Server};

# async fn run(server: Server) {
let request = GraphQLRequest::new("query Greeting($name: String!) { hello(name: $name) }")
    .operation_name("Greeting")
    .variables(serde_json::json!({ "name": "Ada" }).as_object().cloned().expect("object"));

let response = server.execute(&request, Context::new("user-123")).await;
# let _ = response;
# }
```

`Context` wraps `Arc<dyn Any + Send + Sync>`. Use `Context::new(value)` for a typed context,
`Context::empty()` when a request has no user data, and `Context::from_arc` when a framework
already produces `Arc<dyn Any + Send + Sync>`.

`subscribe` returns `Result<gql::SubscriptionResponse, gql::Response>`. Setup errors arrive as a
response, exactly like `gql::subscribe`.

## Error formatting and masking

Execution errors can leak details that belong in logs, not responses. Install one formatter with
`Server::format_error`; it is applied to every error in every response just before the response is
returned or streamed:

```rust no_run
use suku::{Server, mask_internal};

# fn build(schema: gql::Schema) {
let server = Server::new(schema).format_error(|error, context| {
    if context.is_execution() {
        error.clone().with_message("Internal server error")
    } else {
        error.clone()
    }
});

// A conservative built-in policy.
let server = Server::new(schema).format_error(mask_internal);
# let _ = server;
# }
```

The callback receives an `ErrorContext`:

| Accessor | Meaning |
| --- | --- |
| `kind()` / `is_request()` / `is_execution()` | Request phase versus execution phase. |
| `operation_name()` | The requested operation name, or the prepared operation's name. |
| `request_id()` / `prepared_id()` | The persisted-query / prepared-query identifier, if the request carried one. |
| `path()` | The response path attached to the error, when present. |

Only request-scoped values are exposed; the context never contains the schema, resolver value,
user context or other server state. `format_error_with(Arc<dyn ErrorFormatter>)` accepts a shared
trait object when the formatter is a named type.

Coverage is deliberately complete:

* single operations and every response in a batch (in request order);
* persisted operations, including errors from resolving an identifier;
* subscription setup errors and every event in the stream;
* request errors produced by the HTTP layer: malformed JSON, invalid parameters, missing queries,
  extractor denials, 405/406 responses and Axum body-read failures.

`mask_internal` is a policy, not a blanket redactor:

* an error with `extensions.code` is returned unchanged;
* a request error is returned unchanged, because parse/validation/coercion messages describe the
  caller's document;
* any other error becomes a fresh `"Internal server error"` preserving `locations` and `path`;
  `extensions` are removed, since they commonly carry stack traces and backend detail.

`gurafi` marks its authorization and argument-validation errors with `UNAUTHORIZED` and
`BAD_USER_INPUT`, so those deliberate client-facing messages survive.

A resolver that adds an `extensions.code` to an internal error makes that message public, so only
attach codes to safe messages. When that policy is wrong for an application, supply a custom
formatter.

The formatter is called synchronously, once per error, in response order. It must be
`Send + Sync + 'static` and deterministic. Panics are not caught: they unwind through the
execution future, or fail the subscription stream, exactly like a resolver panic.

## Persisted operations

A persisted operation moves parsing, validation and operation selection to startup. `gql` stores
the parsed document in a `PreparedQuery`; `suku` resolves a request identifier to the registered
query and executes it without trusting client-supplied text.

```rust no_run
use suku::{PreparedQueries, Server};

# fn build(schema: gql::Schema) -> Result<(), Box<dyn std::error::Error>> {
let prepared = PreparedQueries::from_json_str(
    &schema,
    r#"{ "hello": "{ hello }" }"#,
)?;

let server = Server::new(schema)
    .prepared_queries(prepared)
    .require_prepared(true);
# let _ = server;
# Ok(())
# }
```

`PreparedQueries` auto-detects these manifest shapes:

| Shape | Example |
| --- | --- |
| Relay / codegen / urql map | `{ "id": "query text" }` |
| Hive / Envelop / codegen operations | `{ "operations": [ { "id", "body", "name", "type" } ] }` |
| Array of operation objects | `[ { "hash": "...", "query": "..." } ]` |
| Object map under `operations` | `{ "operations": { "id": "query text" } }` |

Aliases accepted for the identifier are `id`, `hash`, `sha256Hash`, `queryId` and `documentId`;
the source may be `body`, `query`, `document` or `source`; the operation name may be `name` or
`operationName`. Identifiers and hashes are **opaque keys**: an id spelled `sha256Hash` is looked
up as-is, with no hash verification, so entries must be loaded from a source you trust. Duplicate
object keys in `from_json_str`/`from_json_slice` are rejected rather than silently keeping the last
value; a pre-parsed `serde_json::Value` cannot represent duplicates, so only the text and slice
loaders can detect them.

Requests may send only an identifier:

```json
{ "id": "hello" }
{ "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "hello" } } }
```

`doc_id`, `documentId`, `queryId`, `extensions.id` and `extensions.hash` are also accepted. GET
requests may omit `query` when they carry an identifier, including an APQ-style hash in the
`extensions` query-string parameter:

```text
GET /graphql?extensions={"persistedQuery":{"version":1,"sha256Hash":"hello"}}
```

The `X-Persisted-Query-Id` and `X-Query-Id` headers are a fallback: they apply only when the
request itself carries no identifier, whether as a top-level `id`/`doc_id`/`documentId`/`queryId`
or in `extensions`. They never override an identifier from the request. For a batch the header
fills in every item that has no identifier of its own; the batch size limit bounds how many
operations one header can select, and each item still runs with its own variables and limits. Send
per-item identifiers when one header should not fan out.

If an identifier matches, the registered text wins and any request `query` text is ignored. An
`operationName` on the request must name the prepared operation (or match an unnamed prepared
operation by being absent); a disagreeing name returns a GraphQL error instead of silently running
a different operation. An unknown identifier with supplied query text falls back to normal
execution unless `require_prepared(true)` is set. That fallback does not register or learn the
supplied operation: Apollo APQ's "hash miss then send the query" flow only works in fallback mode,
and a later request with the same hash still needs the query text unless the operation was loaded
into the manifest at startup. In allowlist mode every request must resolve to a registered query;
otherwise the response contains `PersistedQueryNotFound` with
`extensions.code = "PERSISTED_QUERY_NOT_FOUND"`. The HTTP status follows normal request-error
handling: 400 for `application/graphql-response+json`, 200 for legacy `application/json`.

Prepared queries hold the exact [`gql::Schema`] instance they were prepared against. Installing a
registry built for schema A on a `Server` for schema B is rejected at execution with a GraphQL
error, so a prepared query can never resolve fields or introspection data from the wrong schema.
Prepare against the clone the server owns (for example `server.schema().clone()`), not a separately
built schema that merely has the same types.

Prepared subscriptions are supported. Setup and every source event reuse the prepared document,
and the HTTP layer emits them over server-sent events (`Accept: text/event-stream`) exactly as it
does for normal subscriptions.

## HTTP behaviour

### Methods and content types

- `GET` reads `query`, `variables`, `operationName` and `extensions` from the query string.
  `variables` and `extensions` are JSON-encoded objects.
- `POST` requires `Content-Type: application/json` (the `charset` parameter is ignored). The body
  is either one request object or a non-empty JSON array for a batch.
- Any other method returns `405 Method Not Allowed` with `Allow: GET, POST`.
- A missing or non-JSON `Content-Type` returns `415 Unsupported Media Type`.

### Content negotiation

- `application/json` is the legacy response type: execution and request errors both use status
  200, except malformed requests (JSON, parameters, batches), which are 400.
- `application/graphql-response+json` is the modern response type. A response with `errors` and no
  `data` is a request error and gets status 400.
- If both are acceptable, the higher quality value wins; a tie prefers
  `application/graphql-response+json`.
- If nothing acceptable is listed, the server returns 406 with a legacy JSON error body.

Every GraphQL response carries `Vary: Accept` and `Cache-Control: no-store`.

### GraphiQL

`GET` with `Accept: text/html` serves a static GraphiQL page after the context extractor accepts
the request, so a protected endpoint does not expose its API surface anonymously. It uses the
request path as its endpoint, so it works at any mount point. Disable it with `.graphiql(false)`
(Axum builder) or `HttpConfig::graphiql(false)`.

`GET` may only execute **queries**. Mutations and subscriptions over GET are rejected with
`405 Method Not Allowed`, which prevents cross-site request forgery against cookie-authenticated
endpoints. Use `POST` for mutations and `POST` + `Accept: text/event-stream` for subscriptions.

GraphiQL itself makes requests with `Accept: */*`, so the page and the API can share one URL.

### Subscriptions

A subscription request with `Accept: text/event-stream` is executed with `gql::subscribe` and
streamed as server-sent events:

```
event: next
data: {"data":{"countdown":3}}

event: next
data: {"data":{"countdown":2}}

event: complete
```

Validation or setup errors are returned as a JSON response before the stream starts (status 400),
never as a broken stream. A subscription requested without `text/event-stream` receives a clear
GraphQL error; subscriptions cannot be batched.

### Limits

The transport enforces `max_body_bytes` before authentication and parsing. The Axum adapter also
passes the limit to `to_bytes`, so an oversized body is rejected with 413 without being buffered in
full.

Batch execution runs in chunks of `batch_concurrency` with `futures::future::join_all`, preserving
request order while bounding concurrency.

## Authentication

The transport never interprets `Authorization`, `Cookie` or any other header. Authentication is a
closure that receives a `ContextRequest`:

```rust no_run
use suku::{Context, GraphQL, http::{ContextRequest, HttpError}};

# fn build(server: suku::Server) {
let app = GraphQL::new(server)
    .with_context(|request: ContextRequest| async move {
        let token = request
            .header("authorization")
            .and_then(|value| value.to_str().ok());

        match token {
            Some(value) if value.starts_with("Bearer ") => {
                Ok(Context::new(value.trim_start_matches("Bearer ").to_owned()))
            }
            _ => Err(HttpError::message(
                ::http::StatusCode::UNAUTHORIZED,
                "Missing bearer token",
            )),
        }
    })
    .into_router();
# let _ = app;
# }
```

`ContextRequest` is a cloneable snapshot containing the method, URI, headers, `http::Extensions`
and a `cookie(name)` helper. Returning `Err(HttpError)` short-circuits the request before the body
is parsed or a resolver runs; use `HttpError::unauthorized`, `forbidden`, `internal` or `new` to
choose the status.

### Authorization inside execution

Authentication answers *who* the caller is. For field-level authorization, install a
`gql::Authorizer` with `Server::authorizer`. It runs inside `gql` immediately before each resolver
and reports denied fields as GraphQL errors, so partial responses stay correct.

## Batches

A batch is a JSON array of requests. Empty arrays are request errors, arrays larger than the
configured limit are rejected, and each operation still gets its own response (including its own
variable-conversion errors). Batching subscriptions is not supported.

## Production notes

- The crate forbids `unsafe` and its request paths avoid `unwrap`/`expect`/panics.
- SSE is streamed chunk by chunk; the server never buffers an entire subscription.
- Errors exposed to clients are GraphQL messages, not Rust error chains. Install
  `Server::format_error` (and consider `mask_internal`) to redact resolver details while keeping
  `extensions.code`, locations and response paths.
- CORS, tracing, compression and TLS are intentionally left to the application's HTTP framework.
