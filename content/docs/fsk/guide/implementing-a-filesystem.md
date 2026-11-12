---
title: "Implementing a filesystem"
description: "The required methods, the defaulted mutations, and the contracts behind them."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/implementing-a-filesystem.md"
---

`Filesystem` has five required methods and ten defaulted ones. A read-only backend implements
the first group and stops; a writable backend overrides methods from the second group one at a
time.

## The required five

These signatures are the whole read-only surface:

```rust
fn statfs(&self) -> Result<StatFs>;

fn metadata(&self, inode: u64) -> Result<Metadata>;

fn lookup(&self, parent: u64, name: &[u8]) -> Result<(u64, FileType)>;

fn read_directory(
    &self,
    inode: u64,
    cookie: u64,
    verifier: u64,
    sink: &mut dyn DirectorySink,
) -> Result<ReadDirectoryResult>;

fn read(&self, inode: u64, offset: u64, output: &mut [u8]) -> Result<usize>;
```

### `statfs`

Report capacity and inode counts for the volume. The values are advisory and only used for
display and free-space decisions. Return plausible numbers rather than zeroes; a zero
`block_size` is clamped to 1 on Linux, and some tools divide by it.

Windows never calls this method, so a Windows mount has no capacity display. Report file size
through `Metadata::size` instead.

### `metadata`

Return the attributes of one inode. The kernel can ask for any inode it has observed, with no
preceding `lookup`, so this must not depend on a "current directory listing" cache. Return
`Error::STALE` when the inode is no longer valid, and `Error::NOT_FOUND` (`ENOENT`) only when it never
existed.

Every mutation must leave `metadata` consistent: new `size`, new `modified_ns`, bumped
`generation` if the object changed identity, and an updated parent directory.

### `lookup`

Resolve one name inside one directory and return its inode and kind. `parent` must be a
directory; return `ENOTDIR` if it is not. The kind you return is cached by the kernel, so it
must match `metadata(inode).kind`.

Names are never `.` or `..`, and never contain a separator. You do not need to normalise them.

### `read_directory`

Stream entries into the sink, starting at `cookie`. `cookie == 0` starts an enumeration. Stop
when `push` returns `false`, and return the cookie of the last entry that fitted as
`next_cookie`. Set `eof` only when there is nothing left.
[Directories and lookup](directories-and-lookup) covers cookies, verifiers and pagination with
a worked example.

### `read`

Fill `output` from `offset` and return the number of bytes written. Return at most
`output.len()` bytes; a short read is allowed, and `0` means end of file. Reporting more than
the buffer holds is rejected with `EINVAL` by every adapter.

Offset is a `u64`, so clamp it before converting: `usize::try_from(offset)` fails on 32-bit
targets for large offsets, and an offset past the end of the file is a zero-length read, not an
error.

## Mutations are opt-in

Every other method has a default. The default is usually `Error::NOT_SUPPORTED`, which the
adapters translate to `ENOTSUP` on the platform.

| Method           | Default                | Implement when                                               |
| ---------------- | ---------------------- | ------------------------------------------------------------ |
| `set_metadata`   | `NOT_SUPPORTED`        | `chmod`, `chown`, `truncate` or `touch` should work          |
| `write`          | `NOT_SUPPORTED`        | Files accept content                                         |
| `create`         | `NOT_SUPPORTED`        | `mkdir` and file creation should work                        |
| `create_symlink` | `NOT_SUPPORTED`        | The namespace contains symlinks                              |
| `read_symlink`   | `NOT_SUPPORTED`        | The namespace contains symlinks                              |
| `remove`         | `NOT_SUPPORTED`        | `unlink` and `rmdir` should work                             |
| `rename`         | `NOT_SUPPORTED`        | `mv` should work                                             |
| `synchronize`    | `Ok(())`               | You buffer writes that are not durable when the call returns |
| `raw_event_mask` | `RawEventMask::NONE`   | You need native callbacks                                    |
| `raw_event`      | `RawOutcome::Continue` | `raw_event_mask` is non-empty                                |

Implementing a method that only half works is worse than leaving it out. The kernel assumes a
successful return means the operation took effect.

## Partial metadata updates

`set_metadata` receives only the fields the caller wants to change:

```rust
pub struct SetMetadata {
    pub size: Option<u64>,
    pub mode: Option<u32>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
    pub accessed_ns: Option<u64>,
    pub modified_ns: Option<u64>,
}
```

Apply every `Some` field, leave the rest alone, and return the complete updated `Metadata`.
`size` is a truncate: grow with zeroes or shrink the data, and update both `size` and
`allocated_size`. `mode` is already masked to permission bits on some platforms, but masking
with `& 0o7777` yourself is harmless.

There is no `created_ns` field. Creation time is not settable.

## Creating and removing entries

`create(parent, name, kind, mode)` handles regular files and directories. Return the new inode,
and fail with `Error::EXISTS` (`EEXIST`) if the name is taken. `kind` is `File` or `Directory`;
requests for `Symlink` go through `create_symlink` instead.

`remove(parent, name, inode)` receives the inode the caller last observed. Use it to check that
the name still refers to the same object before deleting: if `dir.entries.get(name)` is not
`Some(&inode)`, return `ENOENT`. Check for a non-empty directory before removing anything, and
update the parent's `modified_ns` and directory verifier on success.

A directory with entries must fail with `DIRECTORY_NOT_EMPTY`. Removing the last name of a file
may free the inode, but only once the kernel can no longer reference it.

## Rename and replacement

```rust
fn rename(
    &self,
    source_parent: u64,
    source_name: &[u8],
    destination_parent: u64,
    destination_name: &[u8],
    replaced_inode: Option<u64>,
) -> Result<()>;
```

`replaced_inode` is `Some(inode)` when the kernel expects an atomic replacement of an existing
entry, and `None` when the destination must not exist. Check both cases: return `EEXIST` for
`None` plus an existing name, and remove the replaced object for `Some`.

Replacing a non-empty directory must fail. A rename that changes the parent must be visible
through `lookup` from both directories and must update both parents' `modified_ns` and
directory verifiers.

Linux only forwards `RENAME_NOREPLACE`; `RENAME_EXCHANGE` and whiteout flags are rejected with
`EINVAL` before your backend sees them.

## Symlinks

`create_symlink(parent, name, target, mode)` stores `target` verbatim; it is not resolved.
`read_symlink(inode, output)` copies the stored bytes into `output` and returns their length.
Do not append a NUL terminator.

If the buffer is too small, return an error rather than a truncated target. The memory backend
uses `ERANGE`; `Error::INVALID` also works if you do not want to depend on a platform code.

## Synchronisation

`synchronize` is volume-wide. Adapters call it for `fsync`, `fsyncdir` and `sync`. The default
no-op is correct when a write is durable before `write` returns.

If you buffer, flush everything and report the failure. There is no per-inode fsync callback
and no way to know which file the caller intended, so treat it as a checkpoint for the whole
backend.

## A writable backend skeleton

The shape below is enough for files and directories. It keeps all state behind one `RwLock`;
the [memory backend](examples) shards the map and locks each node so independent files do not
contend.

```rust
use fsk::{Error, Filesystem, Metadata, Result, now_ns};
use std::{collections::BTreeMap, sync::{RwLock, atomic::{AtomicU64, Ordering}}};

struct Node {
    metadata: Metadata,
    data: NodeData,
}

enum NodeData {
    File(Vec<u8>),
    Directory(Directory),
}

struct Directory {
    version: u64,
    entries: BTreeMap<Vec<u8>, u64>,
}

struct Backend {
    nodes: RwLock<BTreeMap<u64, Node>>,
    next_inode: AtomicU64,
}

impl Filesystem for Backend {
    fn write(&self, inode: u64, offset: u64, input: &[u8]) -> Result<usize> {
        let mut nodes = self.nodes.write().unwrap();
        let node = nodes.get_mut(&inode).ok_or(Error::NOT_FOUND)?;
        let NodeData::File(bytes) = &mut node.data else {
            return Err(Error::IS_A_DIRECTORY); // EISDIR
        };
        let start = usize::try_from(offset).map_err(|_| Error::INVALID)?;
        let end = start.checked_add(input.len()).ok_or(Error::INVALID)?;
        if end > bytes.len() {
            bytes.resize(end, 0);
        }
        bytes[start..end].copy_from_slice(input);
        node.metadata.size = bytes.len() as u64;
        node.metadata.allocated_size = bytes.len() as u64;
        node.metadata.modified_ns = now_ns();
        node.metadata.generation = node.metadata.generation.wrapping_add(1);
        Ok(input.len())
    }

    // statfs, metadata, lookup, read_directory and read as above. `remove`,
    // `create` and `rename` follow the same pattern: take the write lock,
    // validate the parent and the entry, mutate, then bump the verifier.
}
```

Locking the whole map is fine for small trees. Before you copy it, decide how `create`,
`rename` and `set_metadata` update: the inode's own metadata, the parent's `modified_ns`, and
the directory's verifier.

## Checklist before mounting

- `ROOT_INODE` resolves, and its `parent` is itself.
- Every inode returned by `lookup` has matching `metadata`, including `kind`.
- `read` never writes past `output.len()` and returns `0` at EOF.
- `read_directory` advances `next_cookie` on every page and sets `eof` only when done.
- Directory verifiers change on every mutation the backend performs.
- Errors are positive; unsupported operations keep the default.

## Next

- [Directories and lookup](directories-and-lookup) for cookies, verifiers and pagination.
- [Reading and writing](reading-and-writing) for data paths and permissions.
- [Network filesystems](network-filesystems) for lazy remote trees.
- [Examples](examples) for the full writable implementation.
