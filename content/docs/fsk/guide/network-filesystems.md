---
title: "Network filesystems"
description: "Lazy remote trees, materialized local files, leases and cache policy."
---

A network backend implements `Filesystem` like any other, then adds `NetworkFilesystem` to
choose between lazy reads through `read` and reads of a file you have already downloaded.

## The trait

`NetworkFilesystem` extends `Filesystem` and adds three defaulted methods:

```rust
pub trait NetworkFilesystem: Filesystem {
    fn network_configuration(&self) -> NetworkConfiguration { /* defaults */ }
    fn open_file(&self, inode: u64, writable: bool) -> Result<NetworkFile> { /* Remote */ }
    fn close_file(&self, inode: u64, file: NetworkFile) -> Result<()> { /* no-op */ }
}
```

Mount it with `MountSession::mount_network` or `MountSession::mount_network_with_options`.
`mount` takes a plain `Filesystem`, so a network backend passed to `mount` loses the open/close
hooks and every read goes through `read`.

`network_configuration()` is read once when the volume starts. Changing it later has no effect
until you remount.

## Configuration

| Field                  | Default        | Meaning                                             |
| ---------------------- | -------------- | --------------------------------------------------- |
| `lazy`                 | `true`         | Resolve metadata and data only when the kernel asks |
| `supports_local_files` | `true`         | Whether `open_file` may return `NetworkFile::Local` |
| `kernel_cache_policy`  | `MetadataOnly` | How much the kernel may cache                       |

`KernelCachePolicy` has four values:

| Variant        | Cache behaviour                                                   |
| -------------- | ----------------------------------------------------------------- |
| `None`         | Retain nothing in the kernel                                      |
| `MetadataOnly` | Cache metadata; route file data back through the backend          |
| `Read`         | Allow clean read data to stay cached                              |
| `ReadWrite`    | Allow read and write caching; the backend must maintain coherency |

The default is conservative: metadata may be cached, but file bytes still come from your
backend. Use `Read` or `ReadWrite` only when you can invalidate correctly.

## Remote or local

`open_file` returns one of two choices:

```rust
pub enum NetworkFile {
    Remote,
    Local(LocalFile),
}

impl LocalFile {
    pub fn new(path: impl Into<PathBuf>, generation: u64) -> Self;
    pub fn path(&self) -> &Path;
    pub fn generation(&self) -> u64;
}
```

`NetworkFile::Remote` keeps the file lazy; reads call `Filesystem::read`. `NetworkFile::Local`
hands the adapter a fully materialized file, and reads of that file bypass your `read` method.

`LocalFile::new(path, generation)` creates a lease:

- The path must remain readable and unchanged until `close_file` returns.
- The path must be valid UTF-8, because the macOS extension opens it through Foundation.
- `generation` is a backend-defined value that changes when the local contents change. The
  adapter forwards it to the kernel so cached data can be invalidated. Bump it whenever you
  rewrite the file, including after re-downloading the same path.

The adapter never deletes or evicts a leased file. It only tells you when the kernel is done
with it.

## Where local files may live

On macOS the backend and the FSKit extension are different processes, and the extension is
sandboxed to the `group.dev.specta.fsk` App Group. A file in your process temporary directory
cannot be opened by the extension. The mount then falls back to remote reads, and older
extensions fail the open outright.

Use `local_file_directory()` and create a backend-specific subdirectory:

```rust
let directory = fsk::local_file_directory()?.join("my-backend");
std::fs::create_dir_all(&directory)?;
let path = directory.join("downloaded.txt");
```

On macOS the function returns
`~/Library/Group Containers/group.dev.specta.fsk/Caches`. On other platforms it returns
`std::env::temp_dir()`. It creates the directory if needed, but the returned root is shared, so
the subdirectory is what keeps independent mounts from colliding.

## Open and close

A lease starts in `open_file` and ends in `close_file`. Keep the cache entry alive between them:

```rust
use fsk::{
    LocalFile, KernelCachePolicy, NetworkConfiguration, NetworkFile, NetworkFilesystem, Result,
};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Mutex,
};

struct Cached {
    path: PathBuf,
    generation: u64,
    last_used: std::time::Instant,
}

struct Drive {
    cache: Mutex<HashMap<u64, Cached>>,
}

impl NetworkFilesystem for Drive {
    fn network_configuration(&self) -> NetworkConfiguration {
        NetworkConfiguration {
            lazy: true,
            supports_local_files: true,
            kernel_cache_policy: KernelCachePolicy::MetadataOnly,
        }
    }

    fn open_file(&self, inode: u64, writable: bool) -> Result<NetworkFile> {
        // A local file is only safe for data the backend can keep stable.
        // Writes stay lazy unless the backend makes them durable itself.
        if writable {
            return Ok(NetworkFile::Remote);
        }
        let cache = self.cache.lock().unwrap();
        let Some(cached) = cache.get(&inode) else {
            return Ok(NetworkFile::Remote);
        };
        Ok(NetworkFile::Local(LocalFile::new(
            cached.path.clone(),
            cached.generation,
        )))
    }

    fn close_file(&self, inode: u64, _file: NetworkFile) -> Result<()> {
        // The kernel has closed its descriptor. Record the activity here and
        // schedule eviction from a worker rather than deleting on this call:
        // another open may share the same path.
        if let Some(cached) = self.cache.lock().unwrap().get_mut(&inode) {
            cached.last_used = std::time::Instant::now();
        }
        Ok(())
    }
}
```

`open_file` errors are returned to the kernel as positive errnos. On Linux, if a local open fails,
the adapter calls `close_file` with the failed lease before replying, so your bookkeeping stays
balanced.

On macOS a duplicate open of an already-open file shares the existing lease; the extra lease is
closed immediately. Do not assume one `open_file` call per `close_file` call in that case.

## Eviction and activity

The crate reports releases; you decide the policy. A practical split:

- `close_file` records last access and marks the entry idle.
- A worker evicts entries by age or total size, skipping anything with an active lease.
- A later `open_file` returns `Remote` for a missing entry, which makes the next read download it
  again.

On Windows there are no local-file leases. ProjFS keeps hydrated content in its own
virtualization root and never evicts it automatically. The Windows `MountSession` adds two
methods for that cache:

```rust
let handle = session.eviction_handle(); // cloneable, does not keep the mount alive
handle.evict("dir/file.txt")?;          // relative to the mount path
```

`MountSession::evict(path)` is the same operation without a handle.
`EvictionOutcome::Evicted` means the cached copy was removed (or was already virtual);
`Retained` means the item has local changes, is a tombstone, is open, or is a non-empty
directory. Both outcomes are retryable, and both leave user data intact. Call eviction outside a
`Filesystem` callback, and do not hold a lock that callbacks need.

## Platform differences

| Platform | Local reads                                                                |
| -------- | -------------------------------------------------------------------------- |
| macOS    | The extension reads the lease with `pread`, bypassing IPC                  |
| Linux    | The FUSE worker reads the local descriptor directly                        |
| Windows  | No local lease; ProjFS hydrates into its cache and serves reads from there |

## Writes

Return `NetworkFile::Remote` for a writable open unless you make the write durable yourself. A
local file that the kernel writes to is invisible to your backend, so the next reader sees local
edits that were never uploaded.

On macOS and Linux, writes routed through `Remote` reach `Filesystem::write`. On Windows they do
not reach the backend: ProjFS keeps them in its cache and reports them through raw notification
events if you asked for them. See [Reading and writing](reading-and-writing).

## The network example

[Examples](examples#network-backend) has a complete small backend that serves one remote file,
materializes a second into `local_file_directory()`, and logs close callbacks.

## Next

- [Platform setup](platform-setup) for the App Group and FUSE prerequisites.
- [Raw events](raw-events) for observing Windows notifications and local writes.
- [Examples](examples) for a backend that materializes files end to end.
