---
title: "Getting started"
description: "Install FSK, implement a read-only filesystem, and mount it as a native volume."
---

Mount a read-only volume with five methods. The filesystem below exposes one file,
`hello.txt`, in the root directory.

You need Rust 1.85 or later, and the platform component from
[Platform setup](platform-setup): `FSK.app` on macOS, FUSE on Linux, or the Projected File
System feature on Windows.

## Install

```sh
cargo add fsk
```

The crate is a single dependency. It re-exports the trait, the data model, the error type and
the platform `MountSession`, so a backend needs no platform-specific imports.

## Check the platform

Mounting depends on host software that Cargo cannot install. Check it before you build
anything:

```rust
use fsk::AuthorizationStatus;

fn platform_is_ready() -> std::io::Result<bool> {
    match fsk::authorization_status()? {
        AuthorizationStatus::Authorized => Ok(true),
        AuthorizationStatus::NotInstalled => {
            // macOS only. `install` downloads the matching FSK.app release.
            #[cfg(target_os = "macos")]
            {
                fsk::install()?;
                fsk::launch_app()?;
            }
            Ok(false)
        }
        // Opens the setup UI (macOS, Windows) and then returns an error telling
        // the user to retry. Linux has no UI, so the error names the requirement.
        AuthorizationStatus::NeedsApproval => {
            fsk::ensure_authorization()?;
            Ok(false)
        }
    }
}
```

| Status          | Meaning                                      | What to do                                                       |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `Authorized`    | The platform can mount now                   | Nothing                                                          |
| `NotInstalled`  | A matching `FSK.app` is missing (macOS only) | Call `fsk::install()`, then `fsk::launch_app()`                  |
| `NeedsApproval` | The component exists but needs a user action | Call `fsk::ensure_authorization()` and retry after the user acts |

`ensure_authorization()` never installs anything. `NotInstalled` returns
`io::ErrorKind::NotFound`; `NeedsApproval` opens the platform UI and returns
`io::ErrorKind::PermissionDenied`. That error is the instruction to run again, not a bug.

On targets other than macOS, Linux and Windows, `authorization_status()` returns
`io::ErrorKind::Unsupported`.

## Implement a filesystem

Five methods are required: `statfs`, `metadata`, `lookup`, `read_directory` and `read`.
Every mutation has a default that returns `ENOTSUP`.

```rust
use fsk::{
    DirectoryEntry, DirectorySink, Error, FileType, Filesystem, Metadata, ReadDirectoryResult,
    Result, StatFs, ROOT_INODE,
};

const HELLO_INODE: u64 = 2;
const HELLO: &[u8] = b"hello, filesystem!\n";

struct HelloFilesystem;

impl Filesystem for HelloFilesystem {
    fn statfs(&self) -> Result<StatFs> {
        Ok(StatFs {
            block_size: 4096,
            io_size: 4096,
            total_bytes: 4096,
            free_bytes: 0,
            available_bytes: 0,
            files: 2,
            free_files: 0,
        })
    }

    fn metadata(&self, inode: u64) -> Result<Metadata> {
        let (kind, size) = match inode {
            ROOT_INODE => (FileType::Directory, 0),
            HELLO_INODE => (FileType::File, HELLO.len() as u64),
            _ => return Err(Error(2)), // ENOENT
        };
        Ok(Metadata {
            inode,
            parent: ROOT_INODE,
            size,
            allocated_size: size,
            generation: 1,
            created_ns: 0,
            modified_ns: 0,
            accessed_ns: 0,
            mode: if kind == FileType::Directory { 0o755 } else { 0o644 },
            uid: 0,
            gid: 0,
            link_count: 1,
            kind,
        })
    }

    fn lookup(&self, parent: u64, name: &[u8]) -> Result<(u64, FileType)> {
        if parent == ROOT_INODE && name == b"hello.txt" {
            Ok((HELLO_INODE, FileType::File))
        } else {
            Err(Error(2)) // ENOENT
        }
    }

    fn read_directory(
        &self,
        inode: u64,
        cookie: u64,
        verifier: u64,
        sink: &mut dyn DirectorySink,
    ) -> Result<ReadDirectoryResult> {
        if inode != ROOT_INODE {
            return Err(Error(2)); // ENOENT
        }
        if verifier != 0 && verifier != 1 {
            return Err(Error::STALE);
        }
        if cookie == 0
            && !sink.push(DirectoryEntry {
                name: b"hello.txt",
                inode: HELLO_INODE,
                kind: FileType::File,
                next_cookie: 1,
            })
        {
            return Ok(ReadDirectoryResult {
                verifier: 1,
                next_cookie: 0,
                eof: false,
            });
        }
        Ok(ReadDirectoryResult {
            verifier: 1,
            next_cookie: 1,
            eof: true,
        })
    }

    fn read(&self, inode: u64, offset: u64, output: &mut [u8]) -> Result<usize> {
        if inode != HELLO_INODE {
            return Err(Error(2)); // ENOENT
        }
        let start = usize::try_from(offset).unwrap_or(usize::MAX).min(HELLO.len());
        let count = output.len().min(HELLO.len() - start);
        output[..count].copy_from_slice(&HELLO[start..start + count]);
        Ok(count)
    }
}
```

Each method answers one question from the kernel:

- `statfs` reports capacity and inode counts for the volume display. Values are advisory.
- `metadata` returns the attributes for an inode the kernel has already seen, with or without a preceding lookup.
- `lookup` resolves one name inside one directory to an inode and its kind.
- `read_directory` streams the entries of one directory starting at a cookie.
- `read` fills the buffer from the file at an offset and returns how many bytes it wrote.

The type must be `Send + Sync + 'static`. Methods are called concurrently, so shared state
needs interior mutability and locks.

## Mount it

```rust
use fsk::MountSession;

fn main() -> std::io::Result<()> {
    let session = MountSession::mount(HelloFilesystem, "/tmp/fsk-hello")?;
    println!("mounted at {}", session.mount_path().display());

    // Keep `session` alive while the volume should be available. Dropping it
    // unmounts and releases the backend.
    std::thread::park();
    Ok(())
}
```

`MountSession::mount` takes the backend by value, mounts it, and returns a session that serves
requests from the calling process. It is synchronous and returns once the mount exists. The
mount directory is created if it is missing.

The session owns the mount. Drop it to unmount; there is no handle back to the backend. A real
program usually waits on a signal instead of parking forever, as the
[examples](examples) do.

## What works out of the box

With only the five methods, you get a mountable read-only volume:

- Directory browsing in Finder, Explorer and Linux file managers.
- `ls`, `stat` and `cat` through the kernel.
- `df` reporting the values from `statfs` (except on Windows, which never calls `statfs`).
- A working `fsync`, because `synchronize` defaults to a successful no-op.

Everything that would change state returns `ENOTSUP`:

| Operation                             | Result                                        |
| ------------------------------------- | --------------------------------------------- |
| `chmod`, `chown`, `touch`, `truncate` | `ENOTSUP` (`set_metadata` is not implemented) |
| `write` on an existing file           | `ENOTSUP`                                     |
| `touch newfile`, `mkdir`              | `ENOTSUP`                                     |
| `ln -s`                               | `ENOTSUP`                                     |
| `unlink`, `rmdir`                     | `ENOTSUP`                                     |
| `mv`                                  | `ENOTSUP`                                     |

That is the intended posture. Leaving the default is better than accepting an operation and
doing nothing, because the kernel assumes success.

## Continue building

- [Core concepts](concepts) explains inodes, names and errors before you write a real backend.
- [Implementing a filesystem](implementing-a-filesystem) covers every optional method.
- [Mounting and lifecycle](mounting) covers options, unmounting and running from an app.
- [Examples](examples) has a complete writable in-memory backend to copy from.
