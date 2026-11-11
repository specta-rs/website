---
title: "Scope auth"
editUrl: "https://github.com/specta-rs/gurafi/blob/main/docs/plugins/scope-auth.md"
---

Authorization is declared on fields, objects and interfaces. It is checked before the resolver
runs and composes with every applicable rule.

## Field rules

```rust
schema.object::<User>(|o| {
    o.field("email", |u: &User, _: NoArgs, ctx: &Ctx| u.email.clone())
        .auth(|ctx: &Ctx| ctx.user.as_ref().is_some_and(|user| user.id == ctx.viewer_id))
        .auth_error("You can only read your own email.");
});
```

`auth` takes a `Fn(&Ctx) -> bool`. For I/O, use `auth_async`:

```rust
o.field("billing", |u: &User, _: NoArgs, ctx: &Ctx| billing(u, ctx))
    .auth_async(|ctx: &Ctx| {
        Box::pin(async move {
            ctx.permissions.has("billing:read").await
        })
    });
```

`auth_error` changes the message returned when the rule denies. If omitted, the client sees
`"Not authorized"`.

Denials are GraphQL field errors with `extensions.code = "UNAUTHORIZED"`, so a server-side
`mask_internal` keeps the message visible while still hiding unexpected internals.

## Object and interface rules

A type-level rule applies to every field on the object, including fields added by later
`object_fields` calls:

```rust
schema.object::<User>(|o| {
    o.auth(|ctx: &Ctx| ctx.user.is_some())
        .auth_error("Sign in to see users");
    // ...
});

let node = schema.interface("Node", |i| {
    i.auth(|ctx: &Ctx| ctx.user.is_some());
    i.field::<gurafi::ID>("id");
});
```

A field must pass:

1. its own field rule,
2. its object's rule(s), and
3. every implemented interface's rule(s).

Reopening a type with another `auth` composes the rules: all must allow. A later `auth_error`
refines the message of the previous rule instead of replacing the check.

Interface field rules are inherited by implementing objects through the same inheritance path as
types and arguments. A mock plugin that replaces an object field's resolver bypasses **field**
auth, but object and interface rules run outside the plugin chain and are never bypassed.

## Scopes

Model the request's grants in the context:

```rust
struct Ctx {
    user: Option<User>,
    scopes: Vec<String>,
}

impl Ctx {
    fn has_scope(&self, scope: &str) -> bool {
        self.scopes.iter().any(|granted| granted == scope)
    }
}

o.field("audit", |_: &User, _: NoArgs, ctx: &Ctx| audit_log(ctx))
    .auth(|ctx: &Ctx| ctx.has_scope("audit:read"))
    .auth_error("Missing scope `audit:read`.");
```

For a policy that applies to many fields, implement a plugin that checks the path or metadata and
wraps the resolver. See [Writing plugins](../guide/writing-plugins).

## Authentication versus authorization

Authentication happens in the server's context extractor. `suku` can reject a request before
GraphQL execution:

```rust
let graphql = suku::axum::GraphQL::new(server)
    .with_context(|request: ContextRequest| async move {
        let user = authenticate(request.header("authorization")).await?;
        Ok::<_, HttpError>(Context::new(Ctx { user, scopes: vec![] }))
    });
```

Authorization stays in the schema. This separation keeps the GraphQL rules testable without HTTP
and lets a different transport reuse them.

## Public fields

A public field simply has no rule, or a rule that allows anonymous requests:

```rust
q.field("viewer", |_: NoArgs, ctx: &Ctx| ctx.user.clone());
```

That field is nullable when it returns `Option<User>`. A non-null field with an optionally
anonymous rule must either always return a value or use `.nullable()`.

## Errors and masking

A denial is deliberate client-facing output. Do not attach internal details to `auth_error`.
`suku::mask_internal` preserves `UNAUTHORIZED`; `format_error` can rewrite messages but should
keep the code and path.

## Testing

Build the schema once and execute with different contexts:

```rust
let anonymous = Ctx { user: None, scopes: vec![] };
let authorized = Ctx { user: Some(ada()), scopes: vec!["audit:read".into()] };
```

Assert both the message and `extensions.code`. See [Troubleshooting](../guide/troubleshooting).

## Next

- [Context](../guide/context)
- [Writing plugins](../guide/writing-plugins)
- [Error masking](../server/suku#error-formatting-and-masking)
