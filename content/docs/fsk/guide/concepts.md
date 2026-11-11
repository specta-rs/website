---
title: "Core concepts"
description: "Inodes, names, metadata, volume statistics, errors and concurrency in FSK."
---

Every backend works with the same five ideas: an inode identifies an object, a byte slice names
it, a `Metadata` value describes it, an `Error` reports failure, and the adapter calls you from
several threads.

## Inodes and identity

`ROOT_INODE` is `1`. Every mount starts there, and the root's `parent` is the root itself.

Every other inode is a `u64` you choose. The kernel treats it as an opaque identifier: it is
never a name, and it does not change when an entry is renamed. Renaming moves the entry to a
different parent directory; the inode stays the same.

An inode must be unique and stable for as long as the kernel can reference it. When you reuse
an inode number for a different object, bump `Metadata::generation`:

```rust
use fsk::{FileType, Metadata, ROOT_INODE, now_ns};
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_INODE: AtomicU64 = AtomicU64::new(2);

fn allocate() -> u64 {
    NEXT_INODE.fetch_add(1, Ordering::Relaxed)
}

fn root_metadata() -> Metadata {
    let now = now_ns();
    Metadata {
        inode: ROOT_INODE,
        parent: ROOT_INODE,
        size: 0,
        allocated_size: 0,
        generation: 1,
        created_ns: now,
        modified_ns: now,
        accessed_ns: now,
        mode: 0o755,
        uid: 0,
        gid: 0,
        link_count: 1,
        kind: FileType::Directory,
    }
}
```

The kernel may call `metadata` or `read` for any inode it has previously observed, without a
fresh `lookup`. When an inode is no longer valid, return `Error::STALE` rather than `ENOENT`.
That tells the kernel to drop its cached reference and look the path up again.

You do not have to allocate sequentially, and you do not have to keep inodes small. A
content-addressed store can hash the path; a database can use its primary key. Only `1` is
reserved.

## Names

Names arrive as `&[u8]` — platform-native bytes, not `String`. On Unix they are arbitrary bytes;
on Windows they are WTF-8. Decode only if your storage requires text, and keep the original
bytes for comparisons.

The adapter guarantees that a name:

- contains no path separator (`/`, or `\` on Windows);
- contains no terminating NUL;
- is not `.` or `..` — the kernel handles those before calling the backend.

macOS reports a maximum name length of 255 characters. The IPC bridge accepts names up to
65,535 bytes, so a long name from another platform is not silently truncated — it is refused.
Enforce your own limit if you store names in a fixed-width field.

## Metadata

`Metadata` is the full attribute set for one inode. Return it from `metadata`, and again after
every change that alters an attribute.

| Field            | Meaning                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `inode`          | The identifier this metadata describes                           |
| `parent`         | Inode of the containing directory; for the root, the root itself |
| `size`           | Logical length in bytes                                          |
| `allocated_size` | Space the object consumes; smaller than `size` for sparse files  |
| `generation`     | Changes when the inode is reused for a different object          |
| `created_ns`     | Creation time, nanoseconds since the Unix epoch                  |
| `modified_ns`    | Last content or metadata change                                  |
| `accessed_ns`    | Last read                                                        |
| `mode`           | POSIX permission bits, for example `0o755`                       |
| `uid` / `gid`    | Owning user and group                                            |
| `link_count`     | Hard link count; use `1` when hard links are unsupported         |
| `kind`           | `FileType::File`, `Directory` or `Symlink`                       |

`mode` carries permission bits only. The object type comes from `kind`, so do not pack `S_IFDIR`
into `mode`. Linux masks it to `0o7777`; Windows derives `FILE_ATTRIBUTE_READ_ONLY` from the
write bits.

Timestamps come from `now_ns()`, which returns nanoseconds since the Unix epoch. On Linux,
`ctime` is reported from `modified_ns` and `crtime` from `created_ns`. On macOS, `changeTime`
is also `modified_ns`. Set `accessed_ns` on reads if you want atime to move, or leave it alone
and accept a fixed value.

`uid` and `gid` have no meaning on Windows and are ignored there. Report the real owner on Unix
if permissions matter.

## Volume statistics

`statfs` returns `StatFs`, which drives `df` and the volume's capacity display.

| Field             | Meaning                            |
| ----------------- | ---------------------------------- |
| `block_size`      | Preferred I/O block size in bytes  |
| `io_size`         | Optimal transfer size in bytes     |
| `total_bytes`     | Total capacity                     |
| `free_bytes`      | Free space                         |
| `available_bytes` | Space unprivileged callers may use |
| `files`           | Total inode count                  |
| `free_files`      | Unused inode count                 |

The values are advisory. Nothing enforces them, and a write can still fail with `ENOSPC`
after you report free space.

Platform notes:

- Linux divides the three byte counts by `block_size` (clamped to at least 1) and reports
  block counts in that unit.
- macOS maps the fields directly onto `FSStatFSResult`.
- Windows never calls `statfs`. Report size through `Metadata::size` instead.

## Errors

Every portable operation returns `Result<T>`, which is `std::result::Result<T, Error>`. `Error`
wraps a positive POSIX errno:

```rust
pub struct Error(pub i32);
```

The five named constants cover the portable cases:

| Constant                     | Value | Meaning                                               |
| ---------------------------- | ----- | ----------------------------------------------------- |
| `Error::IO`                  | 5     | Generic I/O failure (`EIO`)                           |
| `Error::INVALID`             | 22    | Invalid argument (`EINVAL`)                           |
| `Error::NOT_SUPPORTED`       | 45    | Operation is not implemented (`ENOTSUP`)              |
| `Error::DIRECTORY_NOT_EMPTY` | 66    | Directory still has entries (`ENOTEMPTY`)             |
| `Error::STALE`               | 70    | Cached state is invalid; retry from lookup (`ESTALE`) |

The numbers are Darwin's, because the macOS IPC protocol uses them. Adapters translate the
named constants to the local value, so `Error::NOT_SUPPORTED` becomes 95 on Linux. Other
positive values pass through on Unix, which is how you return `EACCES` or `ENOENT`:

| Code | Return                       | macOS       | Linux            | Windows                   |
| ---- | ---------------------------- | ----------- | ---------------- | ------------------------- |
| 2    | `Error(2)`                   | `ENOENT`    | `ENOENT`         | `ERROR_FILE_NOT_FOUND`    |
| 5    | `Error::IO`                  | `EIO`       | `EIO`            | `ERROR_IO_DEVICE`         |
| 13   | `Error(13)`                  | `EACCES`    | `EACCES`         | `ERROR_ACCESS_DENIED`     |
| 22   | `Error::INVALID`             | `EINVAL`    | `EINVAL`         | `ERROR_INVALID_PARAMETER` |
| 45   | `Error::NOT_SUPPORTED`       | `ENOTSUP`   | `ENOTSUP` (95)   | `ERROR_NOT_SUPPORTED`     |
| 66   | `Error::DIRECTORY_NOT_EMPTY` | `ENOTEMPTY` | `ENOTEMPTY` (39) | `ERROR_DIR_NOT_EMPTY`     |
| 70   | `Error::STALE`               | `ESTALE`    | `ESTALE` (116)   | `ERROR_FILE_INVALID`      |

Never return `Error(0)` and never return a negative value. macOS coerces zero to `EPERM`, Linux
maps zero and negatives to `EIO`, and Windows reports `ERROR_INVALID_FUNCTION`. Use
`Error::IO` when nothing more specific applies.

## Concurrency

`Filesystem` requires `Send + Sync + 'static`. Adapters call methods concurrently from several
worker threads, so a backend must synchronise its own state. Blocking is allowed, but a long
operation delays other requests handled by the same adapter thread; do not block forever.

There is no shared lock and no ordering guarantee. If two writes to the same file must
serialise, that is your lock. If a namespace mutation must be atomic across directories, that
is your lock too.

On macOS a panic inside a method is caught per request and reported as `EIO`. Do not rely on
that anywhere else: return an error instead of panicking, and keep panics out of code that
holds a lock.

## What the backend owns

FSK supplies transport, not policy. You own:

- the inode table and the namespace;
- file bytes and their layout;
- any cache, including what to cache and when to evict;
- locks and the concurrency model;
- durability and what `synchronize` must flush;
- consistency: generations, directory verifiers and when an inode becomes stale.

The next pages apply this model to the trait itself. Start with
[Implementing a filesystem](implementing-a-filesystem).
