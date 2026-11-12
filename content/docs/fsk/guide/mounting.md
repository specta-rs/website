---
title: "Mounting and lifecycle"
description: "Mount a backend, choose platform options, keep the session alive and unmount cleanly."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/mounting.md"
---

`MountSession` turns a backend into a live volume. It owns the mount and the service that
answers the kernel, so the mounted filesystem lasts exactly as long as the session value.

## Mount

Every platform exposes the same four constructors:

| Constructor                                   | Backend             |
| --------------------------------------------- | ------------------- |
| `mount(fs, path)`                             | `Filesystem`        |
| `mount_with_options(fs, path, &opts)`         | `Filesystem`        |
| `mount_network(fs, path)`                     | `NetworkFilesystem` |
| `mount_network_with_options(fs, path, &opts)` | `NetworkFilesystem` |

All of them take the backend by value and return `io::Result<MountSession>`. The call is
synchronous and returns once the mount exists: after `mount(8)` succeeds on macOS, after the
FUSE session starts on Linux, and after `PrjStartVirtualizing` succeeds on Windows.

```rust
use fsk::MountSession;

// Ask for the platform component before mounting. This returns immediately
// when the machine is already set up.
fsk::wait_for_authorization(std::time::Duration::from_secs(600))?;

let session = MountSession::mount(MyFilesystem::new(), "/tmp/my-volume")?;
println!("mounted at {}", session.mount_path().display());
```

The session owns the backend; there is no handle back to it. Keep any state you need to reach
from elsewhere in your own `Arc`, not through the session.

## The mount directory

The directory is created if it is missing on all three platforms. It is not removed when the
mount stops.

macOS additionally canonicalises the path before mounting, so `mount_path()` may differ from
what you passed: `/tmp/my-volume` becomes `/private/tmp/my-volume`. The canonical path is what
`diskutil` receives when the session unmounts.

macOS refuses FSKit mounts inside privacy-protected folders: **Desktop**, **Documents** and
**Downloads** (and anything below them) fail with `Operation not permitted`. Choose a directory
under your home directory or in `/tmp`. The mount error includes the same hint, because
`mount(8)` alone only reports the bare EPERM.

macOS and Linux do not check whether the directory is empty: the session creates the path and
mounts over it, and a busy or invalid path is reported by `mount(8)` or FUSE. Windows does:
ProjFS requires an empty directory or one already initialized as a virtualization root, and
rejects anything else before the mount starts.

Dropping the session unmounts:

| Platform | What `Drop` does                                                |
| -------- | --------------------------------------------------------------- |
| macOS    | Runs `diskutil unmount <path>` and discards its error           |
| Linux    | Calls `umount_and_join`, which waits for the dispatcher threads |
| Windows  | Calls `PrjStopVirtualizing`                                     |

`unmount(self)` is the explicit form. On macOS it returns `io::Result<()>`; on Linux and Windows
it returns `()` because the drop path has no error to report.

## Options

Only the fields that change behaviour are listed. Defaults come from `MountOptions::default()`.

macOS:

| Field           | Default | Effect                                     |
| --------------- | ------- | ------------------------------------------ |
| `read_only`     | `false` | Adds `-r` to the `mount(8)` command        |
| `mount_options` | empty   | Joined with `,` and passed as `-o <value>` |

Linux:

| Field                | Default                       | Effect                                                         |
| -------------------- | ----------------------------- | -------------------------------------------------------------- |
| `read_only`          | `false`                       | Mounts with `MountOption::RO` instead of `RW`                  |
| `filesystem_name`    | `"fsk"`                       | Reported by `statfs` and visible in `/proc/mounts`             |
| `worker_threads`     | available parallelism, or `4` | FUSE dispatcher count; values below `1` become `1`             |
| `kernel_permissions` | `true`                        | Adds `DefaultPermissions`, so the kernel checks mode, uid, gid |
| `metadata_ttl`       | one second                    | How long the kernel may cache attributes                       |

Windows:

| Field                     | Default                       | Effect                                   |
| ------------------------- | ----------------------------- | ---------------------------------------- |
| `worker_threads`          | available parallelism, or `4` | ProjFS pool size (`2×` for pool threads) |
| `use_negative_path_cache` | `true`                        | Remembers names reported as absent       |

`MountOptions::read_only` and `filesystem_name` are declared on Windows but are not applied when
the projection starts. A Windows mount is not made read-only by that flag; enforce read-only
through metadata (`mode` without write bits) and `open_file` instead. There is also no volume
name or `statfs` display on Windows.

## Threads and shutdown

Mounting is a blocking call, but serving is not: the session starts the threads that answer the
kernel and returns. macOS runs an accept loop plus one thread per IPC connection, Linux runs its
FUSE dispatchers, and Windows uses the ProjFS pool.

Treat the mount call itself as blocking work. In an async application, call it from
`spawn_blocking` or a dedicated thread rather than on a runtime worker. The same applies to
`fsk::install()`, which downloads and verifies `FSK.app` synchronously.

The session must outlive the mount. A common shape is a dedicated thread that owns the value and
waits for a stop flag:

```rust
use fsk::MountSession;
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

fn main() -> std::io::Result<()> {
    let mount_path = std::env::args().nth(1).expect("usage: my-fs <mount-path>");

    fsk::ensure_authorization()?;
    let session = MountSession::mount(MyFilesystem::new(), &mount_path)?;
    println!("mounted at {} — press Ctrl-C to unmount", session.mount_path().display());

    let running = Arc::new(AtomicBool::new(true));
    let signal = Arc::clone(&running);
    ctrlc::set_handler(move || signal.store(false, Ordering::Release))
        .map_err(std::io::Error::other)?;

    while running.load(Ordering::Acquire) {
        thread::park_timeout(Duration::from_millis(250));
    }

    // Dropping the session unmounts and releases any local-file leases.
    drop(session);
    Ok(())
}
```

On macOS, call `session.unmount()?` instead of dropping when you want to see a `diskutil`
failure. On Linux, stopping waits for in-flight dispatcher calls, so a backend method that never
returns keeps the session alive. Do not block indefinitely inside a trait method.

## Mount failures

Most failures happen before your backend is called.

| Error                                                      | Cause                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `NotFound`, "FSK.app … does not match this SDK"            | `launch_app()` was called without installing a compatible app            |
| `PermissionDenied`, "enable FSK in the window that opened" | A fresh install, or the extension is installed but not enabled           |
| Download or verification error from `install()`            | `ensure_authorization()` could not fetch or validate the matching app    |
| `FSKit mount failed: …`                                    | `mount(8)` rejected the mount; the message carries its stderr            |
| "FUSE must be available"                                   | `/dev/fuse` is missing or is not a character device                      |
| ProjFS initialization error                                | `Client-ProjFS` is missing, or the root is neither empty nor virtualized |

For macOS, read the `mount(8)` stderr before blaming the backend: a disabled extension and a
mount path already in use produce different messages there. On Linux, the mounting user also
needs permission to use `/dev/fuse`, which is separate from the crate.

## Next

- [Network filesystems](network-filesystems) for `mount_network`, local files and leases.
- [Platform setup](platform-setup) for the host-side prerequisites in detail.
- [Troubleshooting](troubleshooting) maps the messages above to fixes.
