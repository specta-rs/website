---
title: "Testing a backend"
description: "Test the trait without a kernel, then add live-mount and concurrency coverage."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/testing.md"
---

Most backend bugs are visible without mounting anything. Call the trait methods directly, use a
small directory sink, and keep a few live tests for the behaviour only a kernel can produce.

## Test the trait directly

A trait method is an ordinary function. Import the trait and call it on the concrete type:

```rust
use fsk::{DirectoryEntry, DirectorySink, Error, FileType, Filesystem, ROOT_INODE};

#[derive(Default)]
struct VecSink {
    capacity: usize,
    entries: Vec<(Vec<u8>, u64, FileType, u64)>,
}

impl DirectorySink for VecSink {
    fn push(&mut self, entry: DirectoryEntry<'_>) -> bool {
        if self.entries.len() == self.capacity {
            return false;
        }
        self.entries.push((
            entry.name.to_vec(),
            entry.inode,
            entry.kind,
            entry.next_cookie,
        ));
        true
    }
}

#[test]
fn lookup_reports_the_same_kind_as_metadata() {
    let fs = MemoryFileSystem::new();
    let inode = fs
        .create(ROOT_INODE, b"hello.txt", FileType::File, 0o644)
        .unwrap();
    let (found, kind) = fs.lookup(ROOT_INODE, b"hello.txt").unwrap();
    assert_eq!(found, inode);
    assert_eq!(kind, FileType::File);
    assert_eq!(fs.metadata(inode).unwrap().kind, kind);
    assert_eq!(fs.lookup(ROOT_INODE, b"missing").unwrap_err(), Error(2));
}
```

This covers lookup, metadata, error mapping and directory enumeration. A
`VecSink` with a small capacity also tests resumption:

```rust
let fs = MemoryFileSystem::new();
for name in [b"alpha".as_slice(), b"beta", b"gamma"] {
    fs.create(ROOT_INODE, name, FileType::File, 0o644).unwrap();
}

let mut first = VecSink { capacity: 2, ..VecSink::default() };
let page = fs.read_directory(ROOT_INODE, 0, 0, &mut first).unwrap();
assert_eq!(first.entries.len(), 2);
assert!(!page.eof);

let mut second = VecSink { capacity: usize::MAX, ..VecSink::default() };
let last = fs.read_directory(ROOT_INODE, page.next_cookie, page.verifier, &mut second).unwrap();
assert!(last.eof);
assert_eq!(first.entries[1].3, page.next_cookie); // last accepted entry resumes here
assert_eq!(second.entries.len(), 1);
```

Assert the exact bytes of names. Comparing `name.to_vec()` catches accidental lossy UTF-8
conversion, which is easy to introduce and hard to see in a mount.

## What needs a live mount

Some behaviour belongs to the kernel or the platform extension:

- authorization status and the setup flow;
- mount and unmount lifecycle, including lease release on drop;
- permission enforcement when `kernel_permissions` is on;
- path traversal from a real process, `df` output, rename and unlink races;
- ProjFS virtualized roots, hydration, notifications and eviction;
- FSKit local-file opens from the sandboxed extension.

Keep those in a small, clearly marked set. Everything else should run in the normal test suite.

## How the crate tests itself

Unit tests live inside `fsk/src/*.rs` and cover pure conversions: error mapping, `statfs` unit
conversion, rename-flag rejection, handle allocation, raw-mask composition, socket and resource
URL encoding, path normalization, WTF-8 round-tripping, hydration across short reads, and the
Swift IPC address encoder.

On macOS, `RustBackendTests.swift` exercises resource validation, packed directory names,
Unix-socket layout, local-file leases, duplicate opens sharing a lease, unreadable local files
falling back, and empty directory pages. It needs no signed extension and no mount.

```sh
./fsk/macos/check.sh
```

That script runs `cargo fmt --check`, Clippy with `-D warnings`, the workspace tests,
`xcodegen generate`, and `xcodebuild test` with `CODE_SIGNING_ALLOWED=NO`.

CI runs that macOS job plus `cargo test --workspace --all-targets` and Clippy on Linux and
Windows. A separate live-mount workflow runs weekly and on changes under `fsk/` or the network
examples. It installs `fuse3`, loads the FUSE module, asserts `/dev/fuse` exists, and mounts both
network examples through FUSE.

## Live mount tests

Live tests are ignored by default because they need a real mount and credentials:

```sh
GITHUB_TOKEN=... GITHUB_REPOSITORY=specta-rs/fsk \
  cargo test -p fsk-github-filesystem -- --ignored live_mount

GOOGLE_DRIVE_ACCESS_TOKEN=... \
  cargo test -p fsk-google-drive -- --ignored live_mount
```

Both names contain `live_mount`, so the filter picks them up. They require FUSE on Linux. The
GitHub test mounts a repository and reads it through the mounted path; the Drive test reads a
`fsk-ci/hello.txt` fixture, overridable with `FSK_DRIVE_TEST_PATH`.

Use the same pattern for your own backend: mount, read through the mount path, assert, drop the
session. Do not put mount tests in the default suite. A CI image without `/dev/fuse` should fail
an ignored test only when someone explicitly asks for it.

## Invariants worth asserting

- **Cookies resume.** Enumerate with a small sink, pass `next_cookie` back, and check that no
  entry is skipped or duplicated. Every page before the last must advance the cookie.
- **Verifiers invalidate.** Enumerate, mutate the directory, call again with the old verifier and
  assert `Error::STALE`, not a silently restarted page.
- **Namespace mutations agree.** After `create`, `remove` and `rename`, check `lookup` from the
  parent, the parent's `metadata().modified_ns`, and the directory verifier.
- **Sparse I/O.** Write past the end, read the hole, and assert zeroes plus the expected
  `size`/`allocated_size` relationship.
- **Capacity is atomic.** A failed growth must not partially consume the budget.
- **Errors are deliberate.** Assert the exact `Error` for missing names, non-empty directories,
  read-only files and unsupported mutations.

The verifier test is short and catches a surprising number of bugs:

```rust
let mut sink = VecSink { capacity: usize::MAX, ..VecSink::default() };
let page = fs.read_directory(ROOT_INODE, 0, 0, &mut sink).unwrap();
fs.create(ROOT_INODE, b"new", FileType::File, 0o644).unwrap();

let mut next = VecSink::default();
let error = fs
    .read_directory(ROOT_INODE, 0, page.verifier, &mut next)
    .unwrap_err();
assert_eq!(error, Error::STALE);
```

If the backend returns `0` for the verifier, this test fails. That is intended: Linux ignores the
value, but macOS and Windows use it to restart safely.

## Concurrency

Adapters call methods concurrently, so a stress test that hammers several methods is worth
keeping. Use a barrier to make the threads collide rather than run in sequence:

```rust
use std::sync::{Arc, Barrier};

#[test]
fn concurrent_writers_never_lose_an_entry() {
    let fs = Arc::new(MemoryFileSystem::new());
    let barrier = Arc::new(Barrier::new(8));
    let mut threads = Vec::new();

    for worker in 0..8 {
        let fs = Arc::clone(&fs);
        let barrier = Arc::clone(&barrier);
        threads.push(std::thread::spawn(move || {
            barrier.wait();
            for index in 0..100 {
                let name = format!("w{worker}-{index}");
                let inode = fs
                    .create(ROOT_INODE, name.as_bytes(), FileType::File, 0o644)
                    .expect("create");
                fs.write(inode, 0, name.as_bytes()).expect("write");
                assert_eq!(fs.lookup(ROOT_INODE, name.as_bytes()).unwrap().0, inode);
            }
        }));
    }

    for thread in threads {
        thread.join().unwrap();
    }

    let mut sink = VecSink { capacity: usize::MAX, ..VecSink::default() };
    fs.read_directory(ROOT_INODE, 0, 0, &mut sink).unwrap();
    assert_eq!(sink.entries.len(), 800);
}
```

Run it under `cargo test --release` too. Debug builds hide some races, and a lock-ordering bug may
need more iterations to appear.

## Share a fake backend

Put shared fixtures in `tests/support/mod.rs` and declare `mod support;` from each integration
test. Keep the fixture on the trait surface: a builder that creates a known tree, a `VecSink`
with configurable capacity, and helpers that assert a directory's exact bytes. That keeps tests
fast and makes failures point at a method instead of a kernel message.

The GitHub and Google Drive examples also run end-to-end tests against fake HTTP servers, so
pagination and caching can be tested without credentials.

## Next

- [Directories and lookup](directories-and-lookup) for cookies and verifiers in detail.
- [Examples](examples) for complete backends and their test layouts.
- [Troubleshooting](troubleshooting) when a live mount disagrees with a unit test.
