---
title: "Architecture"
description: "How the portable traits, platform adapters, FSKit bridge and C ABI fit together."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/architecture.md"
---

FSK is one crate with a portable core and three adapters. The core knows nothing about FSKit,
FUSE or ProjFS; each adapter turns native requests into portable calls and native errors back
again.

## Layers

| Layer              | Location                        | Responsibility                                                      |
| ------------------ | ------------------------------- | ------------------------------------------------------------------- |
| Portable core      | `src/core.rs`                   | `Filesystem`, `Metadata`, `DirectoryEntry`, `StatFs`, `Error`       |
| Network            | `src/network.rs`                | `NetworkFilesystem`, `LocalFile`, cache policy, App Group directory |
| Authorization      | `src/authorization.rs`          | Status checks and setup errors                                      |
| macOS setup        | `macos/rust/authorization.rs`   | `install`, `launch_app`, `uninstall`, release verification          |
| Native events      | `src/raw.rs`                    | Borrowed `RawEvent`, masks and payloads                             |
| Linux adapter      | `src/linux.rs`                  | FUSE session and reply translation                                  |
| Windows adapter    | `src/windows.rs`                | ProjFS projection, callbacks, eviction                              |
| macOS mount bridge | `macos/rust/mount.rs`, `ipc.rs` | `mount(8)`, Unix socket, IPC dispatch                               |
| macOS C ABI        | `macos/rust/ffi.rs`             | In-process bridge used by Swift and compatibility clients           |
| Swift extension    | `macos/FSKExtension`            | FSKit volume semantics and local-file reads                         |
| Companion app      | `macos`                         | `FSK.app`, the setup UI and extension host                          |

The core, network, authorization and raw modules compile on every target. The adapters are
`cfg`-gated, and so are the macOS-only `install`, `launch_app` and `uninstall` functions.

## The request pipeline

A request is decoded by the adapter, optionally shown to the raw hook, then dispatched to your
backend:

```text
kernel
  │  native callback (FUSE / ProjFS / FSKit IPC)
  ▼
platform adapter
  │  decode enough identity to build a RawEvent
  ├── mask bit set? ──▶ raw_event ──▶ Continue / Reject
  │
  │  call the portable method
  ▼
Filesystem / NetworkFilesystem        ← your code
  │  Result<T, Error>
  ▼
platform adapter
  │  translate Error to a native code
  ▼
kernel
```

On macOS there is one more hop: the adapter is a Rust service in your process, and the kernel
talks to the Swift extension in a different process over a Unix socket.

The adapter owns decoding, buffer bounds and error translation. Your backend never sees a native
pointer unless it asked for raw events, and never returns a native error code.

## macOS: FSKit over a Unix socket

FSKit extensions must run inside an app. The crate therefore ships two pieces:

- the Rust service, which owns your backend and serves it from your process;
- the Swift extension inside `FSK.app`, which presents the volume to macOS.

The mount sequence is:

1. `MountSession::mount` creates the mount directory and canonicalises it.
2. It binds a Unix socket at
   `~/Library/Group Containers/group.dev.specta.fsk/Runtime/<pid>-<n>.sock`, with a `0700`
   directory and a `0600` socket.
3. It generates a random 32-byte capability and builds the resource URL
   `fsk://mount?socket=<percent-encoded>&token=<64 hex chars>`.
4. It runs `/sbin/mount -F -t fsk [-r] [-o <options>] <resource> <path>`.
5. The extension parses the resource, connects to the socket, proves the capability and starts
   serving FSKit callbacks over IPC.

The socket path alone is not enough: the per-mount token is the capability that lets the
extension use the service. A process that cannot read the socket or guess the token cannot issue
portable operations.

Inside the extension, the Swift layer implements the FSKit volume: it synthesises `.` and `..`,
offsets cookies, maps `Metadata` to `FSFileAttributes`, applies the kernel cache policy, and
handles local-file leases. It is sandboxed to the `group.dev.specta.fsk` App Group, which is why
materialized files must live under `local_file_directory()`.

`FSK.app` is installed per user and launched once to register the extension. The setup check
requires an exact version match with the crate; an app from another release is reported as not
installed. The IPC payload layout is internal to the Rust/Swift bridge and may change between SDK
versions, so the two are versioned together. The crate's `ABI_VERSION` covers a separate
in-process C ABI, not the extension socket.

## Linux: one process, FUSE

The Linux adapter owns a `fuser::BackgroundSession` and implements the FUSE callbacks in the same
process as your backend. There is no IPC hop.

- `worker_threads` dispatchers serve requests; above one worker the adapter clones the FUSE file
  descriptor so dispatchers do not contend on it.
- Each dispatcher reuses a thread-local read buffer, because FUSE replies copy synchronously.
- Metadata replies carry `MountOptions::metadata_ttl`; kernel permission checks are enabled by
  default through `DefaultPermissions`.
- A local network file is kept as an open descriptor on the dispatcher and read directly.

Unmounting stops the session and waits for the dispatcher threads, then releases outstanding
network leases.

## Windows: ProjFS callbacks

The Windows adapter marks the mount directory as a placeholder with a fresh GUID, then calls
`PrjStartVirtualizing` with a full callback table. ProjFS drives the filesystem by invoking those
callbacks:

- directory enumeration is drained in one callback, with a cookie check between pages;
- placeholder info supplies metadata before content is hydrated;
- file data hydration calls `read` and fills the aligned buffer;
- notifications report opens, creates, deletes, renames, hard links, handle closes and conversion
  to full;
- cancellation has no reply.

The adapter sizes the ProjFS pool from `worker_threads` and enables the negative path cache by
default. Hydrated content lives in the virtualization root and is never evicted automatically;
`eviction_handle` and `evict` call `PrjDeleteFile` for idle, clean items.

ProjFS is a projection, not a write-back filesystem. There is no portable `write`, `create`,
`remove` or `rename` path on Windows.

## Concurrency

`Filesystem` requires `Send + Sync + 'static`. Every adapter calls methods concurrently:

| Platform | Callers                                                                  |
| -------- | ------------------------------------------------------------------------ |
| macOS    | One Rust thread per IPC connection; the extension pools 4–32 connections |
| Linux    | `worker_threads` FUSE dispatchers                                        |
| Windows  | A ProjFS pool sized from `worker_threads`                                |

There is no shared lock and no ordering guarantee between requests. Blocking is allowed, but a
long call occupies the thread that dispatched it, and on Linux it also delays unmount. A panic in
a method is caught per request on macOS and reported as `EIO`; do not rely on that elsewhere.

## The C ABI

`ABI_VERSION` is `2`. It describes an in-process bridge used by Swift tests and compatibility
clients, not the extension socket.

On macOS the `export_filesystem!` and `export_network_filesystem!` macros expose a backend
through that ABI. They are not part of the normal `MountSession` flow; a backend mounted with
`mount` or `mount_network` never sees it. The C-shaped structs re-exported for the bridge are
internal ABI types, not part of the portable API, and the IPC frame format is not public.

## See also

- [Core concepts](guide/concepts) for the data model and error translation table.
- [Mounting and lifecycle](guide/mounting) for session ownership and options.
- [Platform setup](guide/platform-setup) for the host-side prerequisites.
