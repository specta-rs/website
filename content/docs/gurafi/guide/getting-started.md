---
title: "Getting started"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/guide/getting-started.md"
---

Build a schema, run a query, and serve it over HTTP.

In `gurafi`, a GraphQL schema is ordinary Rust code. Each object type has a **backing model**: a
plain Rust type whose values its resolvers return. You derive `Object` on that model, add fields
with resolvers, and call `build()` to get a `gql::Schema`. There is no generated resolver file and
no separate schema definition to keep in sync.

## Install

Add the crates for the layers you need. For an HTTP server:

```toml
[dependencies]
gurafi = "0.1.2"
gql = "0.3.2"
suku = "0.1.2"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

`gql` is the specification engine. `gurafi` is the Rust builder. `suku` serves the finished
schema over HTTP. If you only need to execute against a schema in-process, `gurafi` and `gql`
are enough.

## Create a schema

```rust
use gurafi::Schema;

let mut schema = Schema::<()>::new();

schema.query(|q| {
    q.field("hello", |_: gurafi::NoArgs, _: &()| "hello, World");
});

let schema: gql::Schema = schema.build().expect("valid schema");
```

`Schema::<()>` means the schema has no request context. The root field takes no backing model
argument: root resolvers receive `(Args, &Ctx)`. `NoArgs` is the empty arguments type.

Most schemas also expose application data. Derive `Object` on a Rust type to make it the backing
model of a GraphQL object type:

```rust
use gurafi::{NoArgs, Object, Schema, expose};

#[derive(Object)]
struct Giraffe {
    name: String,
    height_meters: f64,
}

let mut schema = Schema::<()>::new();

schema.object::<Giraffe>(|o| {
    o.expose(expose!(Giraffe::name));
    o.expose(expose!(Giraffe::height_meters as "heightMeters"));
});

schema.query(|q| {
    q.field("giraffe", |_: NoArgs, _: &()| Giraffe {
        name: "Melman".into(),
        height_meters: 5.2,
    });
});

let schema = schema.build().expect("valid schema");
```

The struct is the backing model; `Giraffe` in the schema is the object type. They share a name by
default, but they are separate declarations: the object type is what clients see, and the backing
model is what your resolvers read and return. That model is the first argument of the object's
field resolvers.

Fields are declared explicitly. That keeps the resolver, argument type, authorization and
complexity estimate next to each other. `expose!` is the shortcut for a field that reads a Rust
property.

## Run a query

`gql::execute` is async. Use any executor, including Tokio:

```rust
#[tokio::main]
async fn main() {
    let response = gql::execute(
        &schema,
        gql::Request::new("{ giraffe { name heightMeters } }"),
        &gql::ExecutionOptions::default(),
    )
    .await;

    println!("{}", response.to_json_string());
}
```

The response is a normal GraphQL response: `data` contains the result and `errors` contains
field or request errors.

## Serve over HTTP

```rust
use suku::{Context, Server};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app = suku::axum::GraphQL::new(Server::new(schema))
        .path("/graphql")
        .graphiql(true)
        .with_context(|_| async { Ok::<_, suku::http::HttpError>(Context::empty()) })
        .into_router();

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

Open `http://127.0.0.1:3000/graphql` and run:

```graphql
query {
  giraffe {
    name
    heightMeters
  }
}
```

When you have a request-specific value, replace `Context::empty()` with your own context. The
[context guide](context) covers that pattern.

## Continue building

- [Objects](objects) explains backing models, field declarations and reopening types across
  modules.
- [Fields](fields) covers sync/async resolvers, lists, nullability and field options.
- [Using args](args) shows how a Rust struct becomes a field's arguments.
- [Context](context) connects the server request to your resolvers.
- [Using plugins](using-plugins) covers build-time extensions such as tracing and mocks.

A complete runnable server, including Bearer-token authentication and CORS, lives in
[`examples/axum`](https://github.com/specta-rs/gurafi/tree/main/examples/axum).
