---
title: "Generating client types"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/client-codegen.md"
---

`gurafi` does not ship a client generator. It produces a standard GraphQL schema, which is the
input every GraphQL client generator expects. Export SDL or introspection once, then generate
types with the tool for the client's language.

## Export the schema

```rust
let sdl = schema.sdl();
std::fs::write("schema.graphql", sdl)?;
```

For stable diffs:

```rust
let schema = builder.build_with(gurafi::BuildOptions::new().sort_types(true))?;
std::fs::write("schema.graphql", schema.sdl())?;
```

Start the server and use GraphiQL's schema tab, or POST an introspection query to `/graphql`.
`suku` serves introspection by default; disable it in production if the schema is private.

## Rust clients

For a Rust client, use a GraphQL client crate that accepts a schema file and a `.graphql` query
document. The schema file is exactly the SDL printed above. Keep queries under version control
next to the client code.

## Other languages

TypeScript, Swift, Kotlin, Java and Python generators consume either SDL or introspection JSON.
The GraphQL schema is the contract; no Rust-specific metadata is required.

## Schema evolution

A generated client breaks when a field or type is removed or a type changes incompatibly. Use
`gql::diff` in CI:

```rust
let diff = gql::diff(&old_schema, &new_schema);
assert!(diff.is_compatible(), "{diff:#?}");
```

See [Printing schemas](printing-schemas) for diffing, merging and public/internal variants.

## Relay clients

For Relay, use `gurafi-relay` on the server. Relay's compiler expects global IDs, `Node`,
connections and mutation payloads; the crate generates those shapes with explicit type names. See
[Relay](../plugins/relay).

## Next

- [Printing schemas](printing-schemas)
- [Relay](../plugins/relay)
- [Serving over HTTP](../server/suku)
