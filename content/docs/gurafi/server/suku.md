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
   limit and adapts `HttpResult` to an Axum response. The same route also accepts
   `graphql-transport-ws` upgrades.
4. **`suku::ws`** — a framework-neutral protocol driver over a text-message stream, so the
   WebSocket state machine is tested without a socket.

This is also why `suku` can be tested without a live server: the transport tests call `handle`
directly, the protocol tests drive `ws::serve` over channels, and the Axum tests use
`tower::ServiceExt::oneshot` (plus one real socket test for the upgrade itself).

## Feature flags

| Feature | Default | Purpose |
| --- | --- | --- |
| `axum` | yes | Axum router and authentication helper. |
| `ws` | yes | WebSocket subscriptions via `graphql-transport-ws`; implies `axum`. |
| `multipart` | yes | Multipart file uploads; uses `multer`. |
| `vendored-graphiql` | no | Self-contained GraphiQL page with pinned browser assets. |
| `tracing` | no | Request spans, and `gql/tracing`. |

```toml
# Axum and uploads, no WebSocket.
suku = { version = "0.1.2", default-features = false, features = ["axum", "multipart"] }

# Axum and WebSocket, no uploads.
suku = { version = "0.1.2", default-features = false, features = ["axum", "ws"] }
```

`GraphQL::websocket(false)` is a runtime switch for one mount. When WebSocket support is absent (or
switched off), an upgrade request falls through to ordinary `GET` handling rather than being
misinterpreted.

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
`Send + Sync + 'static` and deterministic. Panics in a formatter are not caught: they unwind
through the execution future, or end the subscription stream. This is different from a resolver
panic, which `gql` catches and turns into a coded `INTERNAL_SERVER_ERROR` field error.

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
- `POST` requires `Content-Type: application/json` (the `charset` parameter is ignored), or
  `multipart/form-data` for a GraphQL multipart request when the `multipart` feature is enabled.
  The JSON body is either one request object or a non-empty JSON array for a batch.
- `GET` with `Upgrade: websocket` and `Sec-WebSocket-Protocol: graphql-transport-ws` is handled as
  a WebSocket connection when the `ws` feature is enabled; see below.
- Any other method returns `405 Method Not Allowed` with `Allow: GET, POST`.
- A missing or unsupported `Content-Type` returns `415 Unsupported Media Type`.

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

The default page loads pinned React 18.3.1, ReactDOM 18.3.1 and GraphiQL 4.1.2 bundles from unpkg. Enable the
`vendored-graphiql` feature to serve a self-contained page instead:

```toml
[dependencies]
suku = { version = "0.1.2", features = ["vendored-graphiql"] }
```

The assets are pinned, MIT-licensed upstream browser builds committed under
`crates/suku/src/http/vendor/` and inlined by `build.rs` into one HTML response. Inlining keeps the
feature transport-agnostic: `http::handle` and the Axum adapter need no extra routes, and the page
makes no network request other than the GraphQL call to its own path. This is the option for
air-gapped and egress-restricted deployments, and for policies that forbid third-party script
origins. Because scripts and styles are inline, a CSP for the page must allow inline script/style
(or their hashes); `connect-src 'self'` is sufficient, and fonts are `data:` URIs.

To update the vendored versions, edit the version constants in
`crates/suku/src/http/vendor/update.sh`, run it, refresh `versions.txt`, and run
`cargo test -p suku --features vendored-graphiql`. The default build stays CDN-backed and pins exact versions; check the
versions in `crates/suku/src/http/graphiql.html` when updating them.

`GET` may only execute **queries**. Mutations and subscriptions over GET are rejected with
`405 Method Not Allowed`, which prevents cross-site request forgery against cookie-authenticated
endpoints. Use `POST` for mutations and `POST` + `Accept: text/event-stream` for subscriptions.
This restriction applies to ordinary HTTP; a WebSocket connection may execute queries, mutations
and subscriptions because the upgrade is authenticated once and is not a simple cross-site
request.

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

### WebSocket (`graphql-transport-ws`)

A `GET` with `Upgrade: websocket` on the GraphQL path is upgraded when it offers the
`graphql-transport-ws` subprotocol. The same path keeps serving GraphiQL, `GET` queries and
`POST` requests; the upgrade is detected from the standard headers before the HTTP handler runs.
The legacy `subscriptions-transport-ws` protocol is not implemented. A client that offers only
that name receives `400` instead of a connection that silently speaks a different protocol.

The protocol is the modern [graphql-ws](https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md)
message set:

| Message | Direction | Meaning |
| --- | --- | --- |
| `connection_init` | client → server | Start the connection. Required once, first. |
| `connection_ack` | server → client | Connection accepted. |
| `ping` / `pong` | both | Liveness; the server echoes a ping's payload. |
| `subscribe` | client → server | Execute `payload` with a unique `id`. |
| `next` | server → client | One execution result for an id. |
| `error` | server → client | Request/setup failure; terminates the id, no `complete`. |
| `complete` | both | End the operation. Client-sent means cancel. |

Queries and mutations produce one `next` and then `complete`. Subscriptions produce a `next` per
event and then `complete` when the source stream ends. If the client sends `complete`, the task is
aborted and no further messages are sent for that id; the id may then be reused. A second
`subscribe` for an id that is still active closes the socket with `4409`.

Errors that prevent any result (parse, validation, coercion, unknown operation, depth/complexity
limits, prepared-query rejection) are `error` messages whose payload is the GraphQL `errors` array.
Field errors are normal execution results and arrive in a `next` payload, exactly as they do over
HTTP. The configured error formatter runs over both.

Protocol close codes are the specification's: `4400` invalid message, `4401` operation before
acknowledgement, `4408` initialisation timeout, `4409` duplicate id and `4429` duplicate
`connection_init`. Message size, active-operation count and initialisation timeout are controlled
by `suku::ws::WsConfig`:

| Option | Default | Meaning |
| --- | --- | --- |
| `connection_init_timeout` | 10s | Close `4408` if no `connection_init` arrives; `None` waits forever. |
| `max_operations` | 32 | Concurrent operations per connection; `0` is unlimited. |
| `max_message_bytes` | server body limit | Maximum size of one JSON message; `0` disables the check. |

Every operation is executed by the same `Server` methods as HTTP, so depth, complexity, breadth,
timeout, prepared queries, authorization and error formatting all apply unchanged.

**Context extraction runs once per connection, at the upgrade.** The request snapshot contains the
usual headers, cookies and middleware extensions; `connection_init.payload` is not an
authentication channel. Every operation on the connection reuses that `Context`. This is what
prevents a client from skipping the authentication that guarded the HTTP upgrade. If credentials
expire, enforce that per operation with `gql::Authorizer` or inside resolvers.

WebSocket handshakes are not subject to CORS preflight, and browsers send cookies with them. When
authentication uses cookies, validate `Origin` (or require a bearer token) in the extractor.
Otherwise a hostile page can open a socket and run mutations with the user's cookies; the
query-only restriction on HTTP `GET` does not apply to messages on an upgraded connection.

**Choosing between WebSocket and SSE:** SSE is an ordinary HTTP response and survives proxies,
CDNs and gateways that do not understand upgrades; it is the better default for a subscription-only
client. WebSocket multiplexes many operations on one connection, allows cancellation and supports
queries/mutations, but requires proxies to forward `Upgrade`/`Connection` headers and to allow
long-lived idle sockets. Both use the same execution path, so switching transports does not change
results or limits.

### Multipart uploads

With the default `multipart` feature, a `POST` with `Content-Type: multipart/form-data` implements
the [GraphQL multipart request specification](https://github.com/jaydenseric/graphql-multipart-request-spec).
The body contains three kinds of field, in this order:

1. `operations` — the JSON request object (or array for a batch), with each file replaced by
   `null`;
2. `map` — a JSON object from a file field name to an array of operations paths;
3. one file part per map entry, named by its key.

```sh
curl http://localhost:3000/graphql \
  -F operations='{ "query": "mutation ($file: Upload!) { uploadAvatar(file: $file) }", "variables": { "file": null } }' \
  -F map='{ "0": ["variables.file"] }' \
  -F 0=@avatar.png
```

Files may be nested anywhere under `variables` (`variables.input.avatar`) and lists are indexed
(`variables.files.0`). A batch prefixes every path with the request index
(`0.variables.file`). One file may be mapped to several paths; the byte buffer is shared. Fields
must be ordered as above, and file field names must be listed in `map` — an unknown or duplicate
file part is rejected rather than ignored.

Paths are validated strictly. Each must be rooted at `variables`, must already exist in the
operations JSON and must currently be `null`. Only paths listed in `map` are written; nothing is
written outside the request's variables. The filename and content type are metadata supplied by
the client: `Upload::filename()` is never treated as a filesystem path.

The parsed files are inserted into the coerced request as `gql::Value::External(gql::Upload)`
(`suku::Upload` is a re-export). Execution stays independent of the transport; a schema defines an
`Upload` scalar whose `parse_value` accepts the external value:

```rust no_run
# fn build(builder: &mut gql::SchemaBuilder) {
let upload = gql::ScalarType::new("Upload")
    .description("A file from a multipart request.")
    .parse_value(|value| {
        if value.as_external::<gql::Upload>().is_some() {
            Ok(value.clone())
        } else {
            Err("Upload must come from a multipart request".to_owned())
        }
    });
builder.add_type(upload.into());
# }
```

A resolver downcasts it:

```rust no_run
use gql::{GraphQLError, ResolverContext, Upload, Value};

# fn resolve(context: &ResolverContext<'_>) -> Result<Value, GraphQLError> {
let upload = context
    .args
    .get("file")
    .and_then(Value::as_external::<Upload>)
    .ok_or_else(|| GraphQLError::new("Expected an upload"))?;
// `upload.filename()`, `upload.content_type()` and `upload.bytes()` are available here.
# let _ = upload;
# Ok(Value::Null)
# }
```

With `gurafi`, `Upload` is a ready-made input scalar. Use it directly in a derived args or input
struct; the scalar is registered when the field or input is declared:

```rust
use gurafi::{Input, NoArgs, Upload};

#[derive(Input)]
struct UploadArgs {
    file: Upload,
}

schema.mutation(|m| {
    m.field_result("uploadAvatar", |args: UploadArgs, ctx: &Ctx| {
        store_avatar(&args.file, ctx)
    });
});
```

The resolver receives the uploaded `Upload` value with `filename`, `content_type` and `bytes`
accessors. `Upload` is input-only: direct output use is a compile error because a file has no GraphQL
response representation. `as_dynamic` remains an unchecked escape hatch for runtime type
references. `schema.scalar::<gurafi::Upload>()` is available when the
scalar should appear in the public schema without a field signature.

Authentication and body-size checks run before multipart parsing. `max_multipart_parts` (default
32, including `operations` and `map`) limits the number of fields, and `max_body_bytes` limits the
whole body. A request over the body limit is `413`; malformed JSON, a malformed `map`, a path
outside `variables`, a non-`null` destination, an unknown file or a missing file is `400` with a
normal GraphQL error body. Plain `application/json` requests are completely unaffected when
`multipart` is disabled or unused.

The entire body is buffered by the Axum adapter before parsing. This implements the request field
structure but not streaming a file directly from the socket into a resolver; bound memory with
`max_body_bytes` and the reverse proxy's own body limit.

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

For a WebSocket upgrade this extractor runs once, before the socket is accepted. A rejection is a
normal HTTP response with the `HttpError` status (for example `401`) and a GraphQL error body.
Every operation on the accepted connection reuses the context; the `connection_init` and
`subscribe` messages cannot replace or extend it. Authenticate at the upgrade, and use
`Server::authorizer` for per-operation checks.

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
- WebSocket subscriptions multiplex operations per connection. Size, initialisation timeout and
  active-operation count are bounded by `suku::ws::WsConfig`; execution limits are shared with
  HTTP. Proxies must forward `Upgrade`/`Connection` and allow idle sockets for as long as the
  longest subscription.
- Uploads are buffered in memory up to `max_body_bytes`. Set the same limit on the reverse proxy
  (`client_max_body_size` in nginx) and leave room for the JSON fields and multipart framing.
  Files are never written to disk by the transport; a resolver decides where the bytes go.
- Errors exposed to clients are GraphQL messages, not Rust error chains. Install
  `Server::format_error` (and consider `mask_internal`) to redact resolver details while keeping
  `extensions.code`, locations and response paths. The formatter applies to WebSocket `error`
  messages and `next` payloads too.
- CORS, tracing, compression and TLS are intentionally left to the application's HTTP framework.
