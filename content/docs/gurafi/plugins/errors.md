---
title: "Typed error result unions"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/errors.md"
---

A fallible field normally reports failure as a GraphQL error. That is the right shape for an
unexpected failure, but some failures are part of the API: a `createUser` mutation may fail
because the address is taken, and the client needs a typed `ConflictError` payload it can switch
on, not a message in the `errors` array.

A field can return `Result<T, E>` where `E` is an enum derived with `ErrorUnion`. The builder
generates a result union from the Rust types:

```graphql
type Mutation {
  createUser(name: String!): MutationCreateUserResult!
}

type MutationCreateUserSuccess {
  data: User!
}

union MutationCreateUserResult = MutationCreateUserSuccess | NotFoundError | ConflictError
```

`Ok(value)` resolves to `MutationCreateUserSuccess { data: value }`, and each `Err` variant
resolves to its own object type. No GraphQL `errors` entry is produced for a typed failure; it is
ordinary response data.

## Full example

```rust
use gurafi::{ErrorUnion, Input, NoArgs, Object, Schema};

struct Ctx;

#[derive(Object)]
struct User {
    name: String,
}

#[derive(Object)]
struct NotFoundError {
    message: String,
    code: String,
}

#[derive(Object)]
struct ConflictError {
    message: String,
    field: String,
}

#[derive(ErrorUnion)]
enum CreateUserError {
    NotFound(NotFoundError),
    Conflict(ConflictError),
}

#[derive(Input)]
struct CreateUserArgs {
    name: String,
}

let mut schema = Schema::<Ctx>::new();

schema.object::<User>(|o| {
    o.field("name", |u: &User, _: NoArgs, _: &Ctx| u.name.clone());
});
schema.object::<NotFoundError>(|o| {
    o.field("message", |e: &NotFoundError, _: NoArgs, _: &Ctx| e.message.clone());
    o.field("code", |e: &NotFoundError, _: NoArgs, _: &Ctx| e.code.clone());
});
schema.object::<ConflictError>(|o| {
    o.field("message", |e: &ConflictError, _: NoArgs, _: &Ctx| e.message.clone());
    o.field("field", |e: &ConflictError, _: NoArgs, _: &Ctx| e.field.clone());
});

schema.query(|q| {
    q.field("ok", |_: NoArgs, _: &Ctx| true);
});

schema.mutation(|m| {
    m.field_result_union::<User, CreateUserError, CreateUserArgs, _>(
        "createUser",
        |args: CreateUserArgs, _: &Ctx| {
            if args.name == "taken" {
                Err(CreateUserError::Conflict(ConflictError {
                    message: "That name is taken.".into(),
                    field: "name".into(),
                }))
            } else {
                Ok(User { name: args.name })
            }
        },
    );
});

let schema = schema.build().expect("valid schema");
```

A client selects the success payload and the error payloads it understands:

```graphql
mutation {
  createUser(name: "taken") {
    ... on MutationCreateUserSuccess {
      data { name }
    }
    ... on ConflictError {
      message
      field
    }
  }
}
```

The response has no `errors` array; the result is the `ConflictError` object.

## API

| Builder | Method | Resolver |
| --- | --- | --- |
| `ObjectBuilder` | `field_result_union` | `Fn(&M, A, &Ctx) -> Result<T, E>` |
| `ObjectBuilder` | `field_result_union_async` | boxed future of the same result |
| `RootBuilder` | `field_result_union` | `Fn(A, &Ctx) -> Result<T, E>` |
| `RootBuilder` | `field_result_union_async` | boxed future of the same result |
| `SubscriptionBuilder` | `field_result_union` | `Fn(A, &Ctx) -> Stream<Item = Result<T, E>>` |

Each has a `*_with_info` form that appends `&gql::ResolveInfo<'_>`, like the other resolver
variants. Root methods work for query, mutation and subscription roots; the generated names use
the configured root name.

The generated type names are:

- `<Parent><Field>Success`, for example `MutationCreateUserSuccess`
- `<Parent><Field>Result`, for example `MutationCreateUserResult`

`<Parent>` is the object's actual GraphQL name, including one created with
`Schema::object_ref`, so `AdminUser.createUser` produces `AdminUserCreateUserSuccess`. The field
name is PascalCased: `createUser` becomes `CreateUser`, and `create_user` also becomes
`CreateUser`.

Reopening an object or building the same schema more than once is idempotent: the generated
types are identified by name and declaration, not appended again. A second declaration of the
same field is still the usual duplicate-field build error.

## Success payload rules

The success member always has exactly one field:

```graphql
type QuerySearchSuccess {
  data: SearchResult!
}
```

`data`'s type comes from `T`:

- `T = String` gives `String!`, `T = i32` gives `Int!`.
- `T = Vec<User>` gives `[User!]!`.
- `T = Option<User>` gives `User`; `None` is a valid `data: null`.
- `T = SearchResult` (a derived `Union`) gives `SearchResult!`; the abstract value still
  resolves through each concrete object's `is_type_of`.
- A custom `OutputType` can declare an interface or another abstract type, and the value it
  converts to still resolves normally.

Only an `Option` loosens the success payload's non-null marker. A bare object model is nullable
as a field type in `gurafi` generally, but a result union's success payload is present whenever
the resolver returns `Ok`, so `data` is non-null.

## Registering error payloads

Every variant holds one object model. The derive validates the enum's shape at compile time:

```rust
#[derive(ErrorUnion)]
enum CreateUserError {
    NotFound(NotFoundError),
    Conflict(ConflictError),
}
```

The payload objects are not registered by the derive. They are ordinary object types, so their
fields and resolvers are declared where the rest of the schema is:

```rust
schema.object::<NotFoundError>(|o| { /* ... */ });
schema.object::<ConflictError>(|o| { /* ... */ });
```

Forgetting one is a build error that names the field and the missing payload:

```text
`Error union member` for `Mutation.createUser` refers to object type `ConflictError`, which was
never registered. Call `schema.object::<...>(...)` or `schema.object_ref::<...>("ConflictError")`
for every error payload type before calling `build()`.
```

The derive rejects generics, unit variants, struct variants, tuple variants with zero or several
fields, and the same payload type in two variants. A GraphQL union cannot include the same object
twice, so that last rule is enforced before the schema is built.

## Errors, codes and masking

A typed error payload is data, not a GraphQL error, so it is never masked by error formatters. The
payload is whatever object model you define; a `code` field is the usual way to give clients a
stable discriminator:

```rust
#[derive(Object)]
struct ConflictError {
    message: String,
    code: String,   // e.g. "NAME_TAKEN"
    field: String,
}
```

`gurafi` deliberately does not synthesize `code`, `extensions` or any other envelope. The payload
is yours, and the same object can be reused by several fields.

Unexpected failures still use normal GraphQL errors. Keep those two paths separate: return
`Err(CreateUserError::...)` for the failures the API documents, and a `GraphQLError` (through
`field_result`, authorization, a custom scalar, or an internal error) for everything else.

Error masking remains a server concern. `suku`'s `Server::format_error` runs over GraphQL errors
before they reach the client; typed error payloads are response data and are not touched by it.
Do not put internal diagnostics in an error payload just because it is typed.

## How the Rust pieces fit

| Rust declaration | Generated GraphQL |
| --- | --- |
| `#[derive(Object)]` error payload | an object type with its normal fields |
| `#[derive(ErrorUnion)]` enum | the union member list and `Err(E)` conversion |
| `field_result_union::<T, E, ...>` | `<Parent><Field>Success` and `<Parent><Field>Result` |
| resolver returning `Result<T, E>` | `Ok(T)` as `data`, `Err(E)` as the matching payload |

Error payloads are registered like any other object, so their fields, authorization and
resolvers live with the rest of the schema. A missing payload is a build error rather than an
execution-time surprise.

## Limitations

- The error enum cannot be generic. Use a concrete enum and concrete payload objects.
- Error payload types are used under their `ObjectModel::NAME`. A runtime-named error payload
  (`object_ref`) is not picked up automatically; register it under the name the enum's payload
  model declares, or wrap the runtime-specific data in a concrete derived object.
- Generated success objects are merged into the schema before build-time plugins run, so field
  metadata plugins see the `data` field. They do not participate in object-level authorization
  declared on the parent, because they are not a user model.
- A field exposes exactly one success type per declaration. To return two different success
  shapes, use two fields or put the alternatives in `T` (for example a derived union).
