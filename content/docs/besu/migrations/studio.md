---
title: "`besu studio`"
editUrl: "https://github.com/specta-rs/besu/blob/main/docs/migrations/studio.md"
---

`besu studio` is a development-only schema and data browser: one HTML page served beside the
introspected schema, a paged row view and a one-statement SQL box. It is a subcommand of the
CLI, so it ships with `besu` and needs nothing extra installed; the server itself lives in the
`besu studio` crate, which is a library and has no binary of its own.

```sh
Usage: besu studio [OPTIONS] --database <DATABASE>

Options:
      --database <DATABASE>
          Connection string for the database to browse, such as `postgres://…` or `sqlite://app.db`

      --port <PORT>
          Port to listen on

          [default: 4983]

      --allow-remote
          Bind every network interface instead of loopback.

          This makes the studio reachable by anyone who can reach the machine, and the studio has no authentication.

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version
```

```sh
besu studio --database sqlite://app.db
# besu studio 0.1.0 listening on http://127.0.0.1:4983
```

`--database` reads `DATABASE_URL` like every other subcommand, so a shell that already exports
it needs no flag. `RUST_LOG` is honoured — `besu studio` is the one subcommand that installs a
tracing subscriber, because a server without its request log is hard to trust.

## What it serves

| Route | Purpose |
| --- | --- |
| `GET /` | The single page, inlined into the `besu` binary |
| `GET /api/schema` | The introspected `Schema` as JSON |
| `GET /api/tables/{table}/rows` | A page of rows, `?limit=` and `?offset=` |
| `POST /api/query` | One SQL statement, body `{ "sql": "..." }` |

The row endpoint projects every column as text, restores numbers, booleans and JSON from the
introspected type, and returns `{ table, columns, rows, limit, offset }`. The default page is
50 rows and the maximum is 500. A table name is checked against the introspected schema before
any statement is built, and the identifier is quoted by the dialect.

The query endpoint returns `{ rows_affected, last_insert_id, warning }` and refuses a request
that the migration splitter does not report as exactly one statement.

## Security posture

There is no authentication, no read-only mode and no audit trail. The query box runs
arbitrary SQL, including statements that write. Treat every process as a shell with a database
connection.

The server therefore:

- binds `127.0.0.1` unless `--allow-remote` is passed, and prints what that means when it is;
- refuses to serve a table name that is not in the introspected schema;
- splits the query body with the same splitter the migration runner uses, and refuses more
  than one statement.

It has no notion of users or permissions: there is no per-user access control, and no query
timeout. PostgreSQL row-level security still applies to whatever role the URL connects as,
and the studio does nothing to change that.

## Gotchas

- **`--allow-remote` is an explicit exposure.** Anyone who can reach the port can read and
  modify the database.
- **The SQL box has no bound parameters.** A bare `?` is a placeholder with no value, so the
  statement fails at the server; `??` is a literal question mark.
- **A row page is capped at 500 rows.** There is no cursor; use the SQL box for anything
  larger.
- **Every API call introspects again.** `/api/schema` reads the whole schema for the table
  list, and each row page reads it again to find its table. A large schema pays for that on
  every request.
- **It is not a migration tool.** It never diffs and never applies a schema; use
  [`besu push`](push) or [`besu migrate`](migrate).

See [the architecture](../architecture#the-studio) for how the studio uses the dynamic
APIs.
