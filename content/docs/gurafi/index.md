---
title: "Gurafi"
description: "Rust crates for building GraphQL servers."
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/README.md"
---

`gurafi` is a type-safe, code-first GraphQL stack for Rust. Rust types describe the schema,
`#[derive]` macros provide the wiring, and the resulting `gql::Schema` is a normal GraphQL
schema that can be executed directly or served over HTTP.

The documentation follows a progressive learning path: start with a schema and a query, then add
models, fields, arguments and context. Each concept is expressed with Rust types, builder methods
and derives rather than with generated resolver types.

## Start here

- [Getting started](guide/getting-started) — install the crates, build a schema, run a query
- [Objects](guide/objects) — turn application data into GraphQL object types
- [Fields](guide/fields) — resolvers, lists, nullability, exposure and field options
- [Using args](guide/args) — typed arguments from Rust structs
- [Using context](guide/context) — request state shared by every resolver

## Guide

- [Enums](guide/enums)
- [Scalars](guide/scalars)
- [Input objects](guide/inputs)
- [Queries, mutations and subscriptions](guide/operations)
- [Interfaces](guide/interfaces)
- [Unions](guide/unions)
- [Schema builder](guide/schema-builder)
- [Using plugins](guide/using-plugins)
- [File layout](guide/app-layout)
- [Circular references](guide/circular-references)
- [Patterns](guide/patterns)
- [Nullability](guide/nullability)
- [Type inference](guide/type-inference)
- [Using GraphiQL](guide/playground)
- [Printing schemas](guide/printing-schemas)
- [Generating client types](guide/client-codegen)
- [Troubleshooting](guide/troubleshooting)
- [Writing plugins](guide/writing-plugins)
- [Integrations and non-goals](guide/non-goals)

## Plugins and extensions

- [Add GraphQL and schema composition](plugins/add-graphql)
- [Complexity](plugins/complexity)
- [Dataloaders and request cache](plugins/dataloader)
- [Directives](plugins/directives)
- [Typed errors](plugins/errors)
- [Mocks](plugins/mocks)
- [Relay](plugins/relay)
- [Scope auth](plugins/scope-auth)
- [Simple objects](plugins/simple-objects)
- [Tracing and observability](plugins/tracing)
- [Validation](plugins/validation)

## Server

- [Serving over HTTP with `suku`](server/suku)
- [Error formatting and masking](server/suku#error-formatting-and-masking)

## Reference

- [Architecture](architecture) — how `gql`, `gurafi`, `gurafi-relay` and `suku` fit together
- [Schema evolution](guide/printing-schemas) — compatibility diffing, SDL snapshots, composition

## Crates

| Crate | Role |
| --- | --- |
| [`gql`](https://github.com/specta-rs/gurafi/tree/main/crates/gql) | GraphQL specification: parser, validation, execution, introspection |
| [`gurafi`](https://github.com/specta-rs/gurafi/tree/main/crates/gurafi) | Rust-first schema builder and type-safe DX |
| [`gurafi-macros`](https://github.com/specta-rs/gurafi/tree/main/crates/gurafi-macros) | Derives for `Object`, `Args`, `Input`, `Enum`, `Scalar`, `Union`, `ErrorUnion` |
| [`gurafi-relay`](https://github.com/specta-rs/gurafi/tree/main/crates/gurafi-relay) | Relay global IDs, `Node`, connections and mutation payloads |
| [`suku`](https://github.com/specta-rs/gurafi/tree/main/crates/suku) | GraphQL over HTTP, batching, SSE subscriptions and error masking |

The crates are deliberately independent: `gql` knows nothing about HTTP or Rust models, `gurafi`
builds only on the public `gql` API, and `suku` only understands `gql::Schema`.
