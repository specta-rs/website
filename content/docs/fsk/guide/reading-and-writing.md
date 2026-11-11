---
title: "Reading and writing"
description: "The data path: reads, writes, sparse files, metadata updates and permissions."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/reading-and-writing.md"
---

`read` and `write` move bytes. `set_metadata` changes attributes. Everything else about
storing those bytes — layout, compression, cache, durability — is yours.

## Reading

`read(inode, offset, output)` fills the caller's buffer and returns how many bytes it wrote:

```rust
fn read(&self, inode: u64, offset: u64, output: &mut [u8]) -> Result<usize> {
    let file = self.file(inode)?; // ENOENT, EISDIR for a directory
    let bytes = file.bytes();
    let start = usize::try_from(offset).unwrap_or(usize::MAX).min(bytes.len());
    let count = output.len().min(bytes.len() - start);
    output[..count].copy_from_slice(&bytes[start..start + count]);
    Ok(count)
}
```

The rules:

- Write at most `output.len()` bytes. Returning a larger count is `EINVAL` everywhere.
- A short read is fine. The kernel calls again for the rest.
- Return `0` only at end of file, or when `offset` is at or past the logical size.
- An offset past EOF is a successful zero-length read, not an error.
- Reading a directory returns `EISDIR`. Reading an unknown inode returns `ENOENT` or `STALE`.

On Windows, `read` hydrates projected content. ProjFS keeps calling until the requested range
is full, so a backend that returns a short read and then `0` in the middle of a file produces
`ERROR_HANDLE_EOF`. Report the true file size from `metadata` as well.

## Writing

`write(inode, offset, input)` returns the number of bytes consumed, not the new file size:

```rust
fn write(&self, inode: u64, offset: u64, input: &[u8]) -> Result<usize> {
    let file = self.file(inode)?;
    let mut state = file.state.lock().unwrap();
    let start = usize::try_from(offset).map_err(|_| Error::INVALID)?;
    let end = start.checked_add(input.len()).ok_or(Error::INVALID)?;
    if end > state.bytes.len() {
        state.bytes.resize(end, 0);
    }
    state.bytes[start..end].copy_from_slice(input);
    state.metadata.size = state.bytes.len() as u64;
    state.metadata.allocated_size = state.bytes.len() as u64;
    state.metadata.modified_ns = now_ns();
    state.metadata.generation = state.metadata.generation.wrapping_add(1);
    Ok(input.len())
}
```

A partial write is allowed: return fewer bytes than `input.len()` and the caller sees a short
write and retries the rest. Most backends return everything or an error.

When the write extends the file, update `size`. A write in the middle does not change `size`,
but it does change `modified_ns` and should bump `generation`. The default `write` returns
`ENOTSUP`.

## Sparse files

`size` is the logical length. `allocated_size` is the space the file really consumes, and it may
be smaller. A 1 MiB file whose bytes are all holes reports `size == 1 MiB` and an
`allocated_size` near zero.

Holes read as zeroes. If your storage does not model them, report `allocated_size == size`; that
is truthful, just less efficient for the volume display. Linux derives the `blocks` count from
`allocated_size` as `allocated_size.div_ceil(512)`.

Do not report `allocated_size > size` unless your storage really over-allocates. Tools use the
pair to estimate compression and thin provisioning.

## Attributes and permissions

`set_metadata` is the only mutation for attributes:

```rust
fn set_metadata(&self, inode: u64, update: SetMetadata) -> Result<Metadata> {
    let mut node = self.node_mut(inode)?;
    if let Some(size) = update.size {
        node.truncate(size)?; // grow with zeroes or shrink
        node.metadata.size = size;
        node.metadata.allocated_size = size;
    }
    if let Some(mode) = update.mode {
        node.metadata.mode = mode & 0o7777;
    }
    if let Some(uid) = update.uid {
        node.metadata.uid = uid;
    }
    if let Some(gid) = update.gid {
        node.metadata.gid = gid;
    }
    if let Some(accessed_ns) = update.accessed_ns {
        node.metadata.accessed_ns = accessed_ns;
    }
    if let Some(modified_ns) = update.modified_ns {
        node.metadata.modified_ns = modified_ns;
    }
    node.metadata.generation = node.metadata.generation.wrapping_add(1);
    Ok(node.metadata)
}
```

Only `Some` fields change. Return the complete updated metadata.

`mode` is permission bits only; the type lives in `kind`. On Linux the adapter masks `mode` to
`0o7777`. On Windows, `uid` and `gid` are ignored, and a mode with no write bits sets
`FILE_ATTRIBUTE_READ_ONLY`.

The Linux adapter mounts with kernel permission checks by default (`MountOptions::kernel_permissions`),
so mode, uid and gid are enforced by the kernel rather than by your backend. If you disable
that, your backend must check access itself and return `EACCES`.

## Error mapping

Return a positive errno. These are the ones you will use most:

| Code                   | Use it when                                            |
| ---------------------- | ------------------------------------------------------ |
| `Error(2)`             | A name or inode does not exist (`ENOENT`)              |
| `Error(13)`            | Permission denied (`EACCES`)                           |
| `Error(20)`            | A path component is not a directory (`ENOTDIR`)        |
| `Error(21)`            | The operation needs a file, not a directory (`EISDIR`) |
| `Error(28)`            | Capacity exhausted (`ENOSPC`)                          |
| `Error(30)`            | The volume or file is read-only (`EROFS`)              |
| `Error::NOT_SUPPORTED` | The backend does not implement the operation           |

The portable constants are translated per platform; the numeric codes above pass through on
macOS and Linux. On Windows they map to the closest `Win32` error, and an untranslated code
becomes `ERROR_INVALID_FUNCTION`. `Error(0)` and negative values are never valid success codes;
they surface as `EPERM`, `EIO` or `ERROR_INVALID_FUNCTION` depending on the platform.

## A writable file with a lock

One `Mutex` per file is enough to serialise reads and writes without blocking other files:

```rust
struct FileNode {
    state: Mutex<FileState>,
}

struct FileState {
    bytes: Vec<u8>,
    metadata: Metadata,
}

struct Fs {
    files: DashMap<u64, Arc<FileNode>>,
    capacity: u64,
}

impl Filesystem for Fs {
    fn write(&self, inode: u64, offset: u64, input: &[u8]) -> Result<usize> {
        let file = self.files.get(&inode).ok_or(Error(2))?;
        let mut state = file.state.lock().unwrap();
        let start = usize::try_from(offset).map_err(|_| Error::INVALID)?;
        let end = start.checked_add(input.len()).ok_or(Error::INVALID)?;
        if u64::try_from(end).unwrap_or(u64::MAX) > self.capacity {
            return Err(Error(28)); // ENOSPC
        }
        if end > state.bytes.len() {
            state.bytes.resize(end, 0);
        }
        state.bytes[start..end].copy_from_slice(input);
        state.metadata.size = state.bytes.len() as u64;
        state.metadata.allocated_size = state.bytes.len() as u64;
        state.metadata.modified_ns = now_ns();
        Ok(input.len())
    }
}
```

Reads take the same lock. `DashMap` comes from the `dashmap` crate, as in the memory backend;
one short global mutex around namespace changes, separate from the per-file locks, keeps
cross-directory rename atomic without serialising reads.

## Windows and durability

ProjFS is a projection, not a write-back filesystem. It materialises content into a
Windows-managed local cache, and local edits stay there. FSK does not call `write`, `create`,
`remove` or `rename` on Windows; the provider observes changes through raw notification events
if it asked for them.

That means a portable backend's write path only runs on macOS and Linux. Writes through a
Windows mount are visible locally but are not delivered to your storage unless you handle
notifications and push the cache contents yourself.

`synchronize` is volume-wide on every platform. If you buffer writes, flush everything there.
There is no per-file fsync callback, so treat it as a checkpoint.

## Next

- [Directories and lookup](directories-and-lookup) for namespace operations.
- [Mounting and lifecycle](mounting) for read-only mounts and options.
- [Raw events](raw-events) for observing native writes on Windows.
