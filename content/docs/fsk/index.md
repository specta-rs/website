---
title: "FSK"
description: "Build cross-platform virtual filesystems in Rust."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/README.md"
---

FSK is a Rust toolkit for building real filesystems. You implement one trait, then mount it as
a native volume: FSKit on macOS, FUSE on Linux, or ProjFS on Windows.

The crate owns the platform plumbing — mounting, IPC, authorization, directory encoding and
lifecycle. Your backend owns the data. A read-only volume only needs five methods; writes are
opt-in.

## Start here

- [Getting started](guide/getting-started) — install the crate and mount a filesystem with five methods
- [Core concepts](guide/concepts) — inodes, names, metadata, errors and concurrency
- [Implementing a filesystem](guide/implementing-a-filesystem) — every trait method, required and defaulted
- [Directories and lookup](guide/directories-and-lookup) — cookies, verifiers and streamed enumeration
- [Reading and writing](guide/reading-and-writing) — data paths, sparse files and permissions

## How it fits together

| Layer                              | Role                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| `Filesystem` / `NetworkFilesystem` | Your type, and the only code you write                            |
| Platform adapter                   | Decodes native requests and translates native errors back         |
| Linux FUSE                         | The adapter is the FUSE session, served from your own process     |
| Windows ProjFS                     | Callbacks for a projected tree; local writes stay in its cache    |
| macOS FSKit IPC                    | A Unix socket to the extension, guarded by a per-mount capability |
| Swift extension inside `FSK.app`   | Install-once; you never build or sign it                          |

The adapter owns decoding, buffer bounds and error translation. Your backend never sees a native
pointer unless it asked for raw events, and never returns a native error code.

## Platform support

| Platform         | Native layer                         | Model                                                | Requirement                                         |
| ---------------- | ------------------------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| macOS 26+        | FSKit                                | Full virtual filesystem; lazy network support        | Install and authorize `FSK.app` once                |
| Linux            | FUSE kernel protocol through `fuser` | Full virtual filesystem; lazy network support        | FUSE must be available                              |
| Windows 10 1809+ | ProjFS                               | Lazy projected tree with Windows-managed local cache | Enable the Projected File System optional component |

On any other target `authorization_status()` returns `io::ErrorKind::Unsupported` and no
`MountSession` exists.

## What FSK leaves to you

FSK does not impose a filesystem design. In particular, it does not provide:

- **Storage** — bytes live wherever you put them; the crate never persists anything.
- **An inode index** — you allocate inode numbers and decide how to find them again.
- **A cache** — no page cache, no attribute cache, no eviction policy of its own.
- **Locking** — adapters call methods concurrently; your state needs your own locks.
- **Transactions** — FSK provides no transaction boundary; a sequence of mutations is not atomic.
- **A consistency policy** — when to bump `generation`, invalidate a cookie or return `STALE` is your call.

This is deliberate. The same trait has to serve a Git server, a cloud drive, and a synthetic
debug view, and those want different answers.

## Guide

- [Getting started](guide/getting-started)
- [Core concepts](guide/concepts)
- [Implementing a filesystem](guide/implementing-a-filesystem)
- [Directories and lookup](guide/directories-and-lookup)
- [Reading and writing](guide/reading-and-writing)
- [Mounting and lifecycle](guide/mounting)
- [Network filesystems](guide/network-filesystems)
- [Platform setup](guide/platform-setup)
- [Raw events](guide/raw-events)
- [Testing a backend](guide/testing)
- [Examples](guide/examples)
- [Troubleshooting](guide/troubleshooting)

## Reference

- [Architecture](architecture) — how the adapters, the IPC protocol and the Swift extension fit together

## Crates and examples

| Resource                                           | What it is                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| [`fsk` on crates.io](https://crates.io/crates/fsk) | The published crate: traits, data model and adapters             |
| [`fsk` on docs.rs](https://docs.rs/fsk)            | API reference for every type and method                          |
| [specta-rs/fsk](https://github.com/specta-rs/fsk)  | Source, issues and releases                                      |
| [Examples](guide/examples)                         | Four complete backends: memory, network, GitHub and Google Drive |

`fsk` requires Rust 1.85 or later and is MIT licensed. Mounting also requires the platform
component listed above; see [Platform setup](guide/platform-setup).
