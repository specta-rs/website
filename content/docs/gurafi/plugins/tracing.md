---
title: "Tracing and observability"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/tracing.md"
---

Every crate in the stack has an **optional** `tracing` feature. It is off by default: a default
build and a `--no-default-features` build do not compile `tracing` at all and contain none of the
instrumentation.

Enable it per crate, or through the crate that re-exports the ones you use:

```toml
[dependencies]
gql = { version = "0.3", features = ["tracing"] }
gurafi = { version = "0.1.0", features = ["tracing"] }
suku = { version = "0.1.0", features = ["tracing"] }
gurafi-relay = { version = "0.1.0", features = ["tracing"] }
```

Features propagate: `gurafi/tracing` also enables `gql/tracing`, `suku/tracing` enables
`gql/tracing`, and `gurafi-relay/tracing` enables `gurafi/tracing`.

The instrumentation only depends on the `tracing` crate itself. The recommended subscriber setup
is `tracing-subscriber`'s `EnvFilter`, so production can keep the summary levels and development
can turn on the hot paths temporarily:

```rust
use tracing_subscriber::{EnvFilter, fmt, prelude::*};

tracing_subscriber::registry()
    .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
    .with(fmt::layer())
    .init();
```

```sh
# Request and operation summaries only.
RUST_LOG=gql=info,gurafi=info,suku=info,gurafi_relay=info

# Field-level and loader investigation.
RUST_LOG=gql=debug,gurafi=debug,suku=debug,gurafi_relay=debug

# Very hot per-field / per-item work.
RUST_LOG=gql=trace,gurafi=trace
```

A runnable example is in [`examples/tracing`](https://github.com/specta-rs/gurafi/tree/main/examples/tracing). It requires the feature:

```sh
RUST_LOG=gql=debug,gurafi=debug \
  cargo run -p example-tracing --features tracing
```

## Span tree

Names are stable and hierarchical. A level in brackets is the span/event level.

### `gql`

```
gql.execute                        INFO   operation, document_bytes, variable_count, kind
├─ gql.parse                       DEBUG  document_bytes
├─ gql.validate                    DEBUG  errors
├─ gql.coerce_variables            DEBUG  definitions
├─ gql.complexity                  DEBUG  list_factor, max_complexity
├─ gql.field                       DEBUG  parent_type, field, path, return_type,
│  │                                      subfields, resolver, fast_path, errors
│  └─ gql.field                    DEBUG  (nested fields, parented by selection)
└─ gql.field.error                 DEBUG  error (message), event only when a field fails
```

`gql.execute_prepared` replaces `gql.execute` when a prepared query is executed; it adds
`prepared_id` (the first eight characters of the identifier, never the whole identifier or the
source) and skips parsing/validation spans because those happened at preparation. `gql.prepare`
and `gql.plan` cover preparation.

Subscriptions add:

```
gql.subscribe                      INFO   operation, document_bytes, variable_count
└─ gql.subscription_setup          INFO   operation, prepared, variable_definitions
   └─ gql.subscription_event       DEBUG  operation, errors        (one per source event)
```

A subscription's response stream is owned by the caller. There is no "stream ended" signal in the
GraphQL API, so teardown is observed by the stream being dropped; the per-event span is the
reliable end-to-end record.

Schema construction is instrumented too:

| Span | Level | Fields |
| --- | --- | --- |
| `gql.schema.build` | INFO | `types`, `directives` |
| `gql.schema.validate` | DEBUG | `types`, `directives` |
| `gql.schema.from_sdl` | INFO | `sdl_bytes` |
| `gql.schema.merge` | INFO | `types`, `incoming_types`, `changed` |
| `gql.schema.builder.merge` | INFO | `types`, `incoming_types` |
| `gql.schema.transform` | INFO | `types` |
| `gql.schema.retain_types` | INFO | `types` |
| `gql.schema.without_types` | INFO | `types`, `removed` |
| `gql.schema.extend_sdl` | INFO | `sdl_bytes`, `types`, `changed` |

### `gurafi`

```
gurafi.schema.build                INFO   objects, interfaces, unions, plugins, query_fields
├─ gurafi.schema.plugins           DEBUG  plugins, fields_visited
├─ gurafi.auth                     TRACE  (per authorization check)
├─ gurafi.validator                TRACE  args (Rust type name)
└─ gurafi.resolver                 TRACE  parent_type, field
   └─ gurafi.loader.load           DEBUG  key_type, cache_hit
      └─ gurafi.loader.batch       DEBUG  queue_len, batch_size, deduplicated,
                                           duration_us, errors
         └─ gurafi.loader.error    DEBUG  batch_size, errors
```

`gurafi.error_union.dispatch` is a TRACE event with `field` and `outcome` (`success` or `error`).
`gurafi.cache.lookup` is a TRACE event with `hit` (and `inserted` on a miss that builds a value).

### `gurafi-relay`

| Span/event | Level | Fields |
| --- | --- | --- |
| `relay.node` | DEBUG | `requested`, `allow_local`, `cache_hit`, `loader_calls`, `resolved`, `errors` |
| `relay.nodes` | DEBUG | `requested`, `allow_local`, `cache_hits`, `loader_calls`, `resolved`, `nulls` |
| `relay.connection.page` | DEBUG | `items`, `first`, `after`, `last`, `before`, `edges`, `has_next_page`, `has_previous_page` |
| `relay.mutation` | DEBUG | `result_type`, `has_client_mutation_id` |

Connection cursor *values* are never recorded; only whether `first`/`after`/`last`/`before` were
present, and the resulting flags/counts.

### `suku`

```
suku.request                       INFO   method, path, body_bytes, status
├─ suku.parse                      DEBUG  body_bytes, max_batch_size
├─ suku.process                    DEBUG  batch_size, operation, request_id
│  ├─ suku.execute                 DEBUG  operation, prepared, document_bytes,
│  │                                       variable_count, errors
│  │  └─ gql.execute               INFO   (the gql tree above)
│  ├─ suku.execute_batch           DEBUG  batch_size, concurrency
│  └─ suku.subscription            DEBUG  operation, prepared
├─ suku.serialize                  DEBUG  status, errors, body_bytes
└─ suku.serialize_batch            DEBUG  responses, body_bytes
```

`suku.request.error` is a WARN event with `status` and `code` for transport/extractor failures
(`REQUEST`, `CONTEXT`, `ACCEPT`, `METHOD`). `suku.subscription.event` is a TRACE event with
`errors` and `has_data` for each SSE response.

## What is safe (and what is deliberately absent)

Debugging performance needs shapes, counts and timings, not payloads. The instrumentation never
records:

- GraphQL variable values, argument values, resolver data or database keys;
- request/response bodies, headers, cookies or bearer tokens;
- GraphQL documents or persisted-query source text (only byte lengths and short identifier
  prefixes).

The loader records only the *key type* (`std::any::type_name::<K>()`), never key values. Relay
records cursor presence, not cursor values. `suku` records the HTTP path but not the query string,
body, or `Authorization` header.

## Performance notes

- Default builds contain no tracing code. With the feature enabled but no subscriber, every
  instrumented site is behind a callsite check and costs a branch, not an allocation.
- Expensive field expressions (path formatting, type formatting) are inside `enabled!` guards and
  are not evaluated when the target/level is filtered out.
- `gql.field` and loader batches are DEBUG because they run per field and per batch. Use them
  while investigating an operation, not as a permanent production INFO stream.
- `gurafi.auth`/`gurafi.validator`/`gurafi.resolver` are TRACE because they are per-field hot
  paths. Enable them for one reproduction, then turn them off.
- Summary spans (`gql.execute`, `gql.schema.build`, `suku.request`) are INFO and safe as the
  normal production level. They give request latency, operation identity, status and error
  counts without touching resolver data.

## Limitations

- Timings are span/event durations as observed by the subscriber; they include scheduling time
  and are not a substitute for a profiler.
- While a subscriber accepts `gql::field` at DEBUG, the executor declines its synchronous leaf and
  subtree shortcuts so every field flows through the instrumented asynchronous wrapper. This costs
  some extra work during tracing and is intentional: a document at the parser's depth limit would
  otherwise have no field spans on those paths. With no subscriber the original fast paths run
  unchanged.
- `fast_path` on `gql.field` means the field is *eligible* for the executor's leaf shortcut (no
  asynchronous resolver, no synchronous property resolver and no arguments). While field tracing
  is active the shortcut itself is bypassed, so the span is the record of the field rather than of
  the shortcut. `resolver` is true when the field has either kind of resolver; a field with only a
  synchronous property resolver still runs it inline, but it is not a leaf-shortcut property.
- `gql.execute_operation` is not a separate span; operation kind and name are fields on the
  `gql.execute`/`gql.execute_prepared` root. Selection counts are available as `subfields` on each
  field span.
- The parse, validation, coerce and complexity spans are created but not entered. This keeps the
  top-level execution future the same size on a stack-constrained thread; their creation-to-drop
  duration and parent are still recorded.
- `tracing` is a library feature, not an exporter. Configure a subscriber (and an OpenTelemetry
  bridge if needed) in the application.
- Enabling the feature changes the public dependency graph, not the public API. Instrumentation
  does not change behaviour, error messages, ordering or allocations of a request.
