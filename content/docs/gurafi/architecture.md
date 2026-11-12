---
title: "Architecture"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/architecture.md"
---

Gurafi is split into layers with one rule: **lower layers never know about higher
layers**.

| Layer | Crate | Knows about |
| --- | --- | --- |
| Specification engine | `gql` | GraphQL documents, types, execution, introspection |
| Developer experience | `gurafi` (+ `gurafi-macros`) | `gql`, Rust types |
| Relay | `gurafi-relay` | `gurafi`, Relay conventions |
| Transport | `suku` | `gql`, HTTP |

This is what makes it possible to build another high-level API or another
transport without forking the engine. Nothing in `gql` names `gurafi`, `suku`,
`axum`, a database or an authentication scheme.

## `gql`: the specification

`gql` is a reference implementation of the [GraphQL October 2021
specification](https://spec.graphql.org/October2021/). Its public surface is
explicit and stable:

| Module | Responsibility |
| --- | --- |
| `ast` | Borrowed abstract syntax tree for executable documents and SDL |
| `parser` | Hand-written lexer and recursive-descent parser for the whole grammar |
| `schema` | Immutable, validated `Schema`; `SchemaBuilder`; SDL import; schema diffing |
| `types` | Scalars, objects, interfaces, unions, enums, input objects, fields, directives |
| `validation` | Every executable-document validation rule |
| `execution` | Variable/argument coercion, field collection, resolvers, subscription events |
| `introspection` | `__schema`, `__type`, `__typename` and the introspection type system |
| `complexity` | Static query cost and depth estimation |
| `sdl` | SDL printing |
| `value` | Runtime input/result values, including opaque `External` backing model values |

### Design decisions

- **Names, not pointers.** A field's type references another type by name.
  Recursive schemas therefore need no interior mutability. The builder resolves
  and validates every name once.
- **Immutable schemas.** `Schema` is cheap to clone (`Arc` inside) and safe to
  share across threads and requests.
- **Values are explicit.** Execution produces `Value`, not JSON. Transports
  decide how to serialize; tests can assert structure without a JSON round trip.
- **No hidden panics.** Malformed input, invalid schemas and failed coercion
  become `GraphQLError`s; the engine itself does not panic on them. A panic in
  user resolver code (a field resolver, a subscription setup resolver,
  `resolve_type` or `is_type_of`) is caught at that boundary and reported as a
  field error with `extensions.code` `INTERNAL_SERVER_ERROR`, so it cannot unwind
  a request or end a subscription stream. Public APIs do not use `unsafe`.
- **Errors are data.** `GraphQLError` carries source locations, response paths
  and extensions, and implements `serde::Serialize` when the `serde` feature is
  enabled.
- **Opaque backing model values.** `Value::External` lets a type-safe layer pass its own
  Rust models (`User`, `Post`, …) between resolvers. The engine never tries to
  serialize them.

### Execution pipeline

```
source ──parse──► AST ──validate──► AST ──select operation──►
coerce variables ──complexity/depth checks──► collect fields ──►
resolvers ──complete values (null propagation) ──► Response { data, errors }
```

Every stage can short-circuit with specification-shaped errors. Resolvers are
only reached by a valid operation with valid variables.

### Performance

- The parser borrows names and string literals from the source.
- Names are interned once per schema (`Arc<str>`).
- Object values use an inline `SmallVec`, avoiding a heap allocation for the
  common small-object case.
- Field collection groups by response key once per selection set and deduplicates fragments.
- Sibling fields on queries resolve concurrently with a bounded limit; mutations stay serial.
- Introspection results are descriptors, not copies of the whole schema.
- Complexity analysis runs before execution, so expensive operations are
  rejected before any resolver or database call.
- Fields declared with `gurafi`'s `expose!` use a synchronous property resolver.
  The executor calls it inline on the leaf fast path and the general completion
  path, so a plain backing model read allocates no future (and no path clone or
  batch slot). A field whose options need a future — auth, async auth, validation
  or a `wrap_resolve` plugin — is converted to the boxed path once, at build time.

## `gurafi`: developer experience

`gurafi` exists to make the common case feel like writing Rust, not like
describing a schema:

- Rust types infer GraphQL types (`String` → `String!`, `Option<T>` → nullable,
  `Vec<T>` → list, `Result<T, E>` in fallible resolvers).
- `#[derive(Object)]`, `#[derive(Input)]`/`#[derive(Args)]`, `#[derive(Enum)]`,
  `#[derive(Scalar)]` and `#[derive(Union)]` connect Rust models to the engine.
- `expose!(Model::field)` creates a field from a Rust field with its name and
  type inferred.
- Field args are derived from a typed input struct; argument declarations are
  not duplicated. An input is args-only unless it is explicitly named, so no
  `FriendsArgs` type leaks into the schema.
- Types and roots can be reopened across modules (`object_fields`,
  `interface_fields`, `query_fields`, ...), so declarations merge naturally.
- `.auth(...)`, `.complexity(...)`, `.description(...)`, `.deprecated(...)`,
  `.nullable()`, `.non_null()` and `.as_type::<T>()` attach the same metadata
  with build-time checks.
- Object- and interface-level authorization, validation hooks, one-of inputs and
  resolver info are first-class.
- Interfaces, unions, enums, custom scalars, custom directives and subscriptions are first-class.
- Plugins provide build-time field hooks for tracing, mocks, scopes and response extensions.
- Runtime-named references support Relay connections, payloads and generated result unions.
- `Loader` and `RequestCache` provide request-scoped batching and caching.
- `#[derive(ErrorUnion)]` and `field_result_union` expose typed failures as GraphQL unions.

Everything `gurafi` produces is a normal `gql::Schema`; `suku` (or any other
transport) cannot tell the difference.

## `gurafi-relay`: Relay conventions

`gurafi-relay` is a thin layer over the `gurafi` builder:

- typed global IDs and the shared `Node` interface
- `node`/`nodes` dispatch with request-scoped caching
- connections, cursor pagination and `PageInfo`
- mutation payloads with `clientMutationId`

It uses runtime-named object references, so connection and payload type names do not need
code generation.

## `suku`: transport

`suku` turns a `gql::Schema` into an HTTP service:

- POST/GET GraphQL over HTTP with correct content negotiation and status codes
- JSON batching
- Server-sent-event subscriptions
- GraphiQL
- Request limits (body, depth, complexity, errors, batch size)
- A context extractor for authentication (Bearer tokens, cookies, headers)
- Field authorization through `gql::Authorizer`

`suku` has no schema-building logic and no knowledge of `gurafi` types.

## Testing philosophy

- Parser tests cover the full grammar and lexical edge cases.
- Validation tests cover every specification rule.
- Execution tests cover aliases, fragments, directives, variables, coercion,
  lists, null propagation, abstract types, mutations and subscriptions.
- Introspection tests compare against the standard introspection query.
- Schema diff tests pin backwards-compatibility behaviour.
- `gurafi` tests exercise the public API end to end, including derive macros.
- `suku` tests exercise HTTP behaviour without opening sockets where possible.
