---
title: "Troubleshooting"
description: "Symptom, cause and fix for mount, authorization and enumeration problems."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/troubleshooting.md"
---

Most problems fall into three groups: the platform component is not ready, the adapter cannot
translate what the backend returned, or the directory contract was not met. Find the message
below before changing the backend.

## macOS

### `authorization_status()` says `NotInstalled` after installing

The status reads `FSKProtocolMajor` from the embedded extension's `Info.plist` and the bundle
identifier `dev.specta.fsk`. The app is compatible when the protocol major matches and the
identifier is correct; the marketing version is irrelevant. An app with no protocol keys is
treated as legacy protocol 1.0.

Point `FSK_APP_PATH` at a development build, or run `fsk::install()` to replace an app whose
protocol major does not match the SDK.

### `ensure_authorization()` fails to install `FSK.app`

It downloads the release matching the crate version, so a git build between releases still
downloads the last released app. Check the network, `FSK_RELEASE_BASE_URL`, and any
`GITHUB_TOKEN` or `GH_TOKEN` used for a private release. Running `fsk::install()` directly
surfaces the same error.

### `launch_app()` says the app does not match this SDK

`launch_app()` refuses to open a missing or incompatible copy so a stale app is never launched.
Call `fsk::install()` first, or use `fsk::ensure_authorization()`, which installs and launches in
one step.

### Status stays at `NeedsApproval`

The app is installed but the extension is not enabled. `launch_app()` opens the setup window;
the user must flip the switch in **System Settings → General → Login Items & Extensions → File
System Extensions**. macOS exposes no API for it, so retrying before the user acts changes
nothing. `fsk::wait_for_authorization(Duration::from_secs(600))` retries safely once the switch
is on.

`pluginkit` is not that switch. `pluginkit -m -p com.apple.fskit.fsmodule` printing `+` only
shows that the extension is registered, and `pluginkit -e use -i dev.specta.fsk.extension`
exits successfully without changing FSKit's enabled state. Do not use either to check or change
authorization.

### Approval was lost after upgrading

Approval belongs to the installed bundle, not the bundle identifier. Replacing a machine-wide
`/Applications/FSK.app` with the per-user copy in `~/Library/Application Support/dev.specta.fsk/`
needs the switch in System Settings to be enabled again, even when the protocol major version is
unchanged. `install()` quits a running legacy copy before removing it.

### `FSKit mount failed: … Operation not permitted`

`mount(8)` could not attach the volume. On current macOS the usual cause is the mount directory:
FSKit refuses mounts inside **Desktop**, **Documents** and **Downloads** because they are
privacy-protected. Mount under your home directory or in `/tmp` instead. The crate appends this
hint to the error; other EPERM causes are a disabled extension or a path the extension cannot
reach (see the next entry).

### `FSKit mount failed: …`

The message after the colon is `mount(8)`'s stderr. Read it before blaming the backend. The
usual causes are a missing or disabled extension and a mount path that is already in use.

### The extension still runs old code after a rebuild

Toggle the extension off and on in System Settings, or reinstall it. The running extension
process is not replaced just because the bundle changed on disk.

### `install()` refuses to replace a path that is not an `FSK.app` bundle

`FSK_APP_PATH` points at a directory that is not the bundle itself. It must name the `.app`
folder. Symlinks are removed as links, never followed, and a mount point is refused.

### `FSK_APP_PATH` validation errors

`must be an absolute path`, `must not contain '..'`, `must name a folder ending in '.app'` and
`must not be empty` are all explicit checks. Fix the value; there is no fallback.

### The release download fails

Releases must be publicly downloadable. Otherwise set `GITHUB_TOKEN` or `GH_TOKEN` to resolve a
private release through the GitHub API, or set `FSK_RELEASE_BASE_URL` to a mirror that serves
`{base}/v{version}/FSK-v{version}.zip`.

### A mirrored asset is rejected by signature or Gatekeeper

The installer requires identifier `dev.specta.fsk`, team `68994Z5PT3`, a valid `codesign
--verify --deep --strict`, and a successful `spctl --assess --type execute`. Rebuild or re-sign
the mirror with the release identity.

### `ENOTSUP` on `chmod`, `mkdir`, writes or `mv`

The backend did not override the mutation method, so it returns the default
`Error::NOT_SUPPORTED`. This is intentional. Implement the method; do not return `Ok` without
doing the work.

### A local file never opens from the mount

On macOS the path must be inside the `group.dev.specta.fsk` App Group. A path in the process
temporary directory cannot be opened by the sandboxed extension, so the mount falls back to
remote reads, or an older extension fails the open. Use `local_file_directory()` plus a
backend-specific subdirectory.

### Readdir loops or returns `ERANGE`

A page produced no entries and did not report `eof`. The bridge turns that into `ERANGE` so the
caller grows its buffer. Always advance `next_cookie`, and set `eof` when the enumeration is
finished.

### A directory entry is missing

Names are limited to 65,535 bytes over IPC, and the volume reports a 255-character maximum. A
longer name is refused rather than truncated. Enforce your storage's own limit if it is smaller.

## Linux

### `NeedsApproval`, or `ensure_authorization()` says FUSE must be available

`/dev/fuse` is missing or is not a character device. Install `fuse3`, load the module with
`modprobe fuse`, and check the device permissions. There is no setup UI.

### The mount fails with a permission error

The mounting user cannot use `/dev/fuse`. Common causes are a container without the device
passed through, a missing `fusermount3`, or a user namespace that blocks mounts. This is outside
FSK.

### `unmount()` or drop hangs

`umount_and_join` waits for the dispatcher threads. A backend method that never returns keeps the
session alive. Do not block indefinitely inside a trait method, and do not hold a lock across a
network call without a timeout.

### Metadata is stale after a change

The kernel caches attributes for `MountOptions::metadata_ttl` (one second by default). Lower the
TTL in tests, or re-stat after it expires. This is kernel caching, not a backend inconsistency.

## Windows

### The mount fails immediately

Either `Client-ProjFS` is not enabled (`ProjectedFSLib.dll` is missing), or the root is not empty
and is not already a virtualization root. Enable the feature, or choose a fresh directory.

### Writes "work" but the backend never sees them

ProjFS keeps local edits in its cache and reports them as notification events. FSK does not call
`write`, `create`, `remove` or `rename` on Windows. Handle `Operation::Notification` or upload
the cache yourself.

### `statfs` values never appear

Windows never calls `statfs`. Report size through `Metadata::size`.

### A read-only mount is still writable

`MountOptions::read_only` is declared on Windows but not applied when the projection starts.
Enforce read-only through metadata (`mode` without write bits) and `open_file`.

### `ERROR_INVALID_FUNCTION` ("Incorrect function")

The backend returned an errno the Windows mapper does not translate. Use the portable `Error`
constants and the common positive codes; anything else becomes `ERROR_INVALID_FUNCTION`.

### Hydrated files never leave the cache

ProjFS never evicts automatically. Keep an `EvictionHandle` from
`session.eviction_handle()`, or call `session.evict("dir/file.txt")`. Items with local changes,
open handles, tombstones or non-empty directories are retained by design; retry after handles
close. Call eviction outside a callback and without holding a lock that callbacks need.

## Any platform

### An operation succeeds but nothing changed

A mutation method returned `Ok` without doing the work. The kernel assumes success and will not
retry. Leave the default `NOT_SUPPORTED` instead of pretending.

### `EIO` with no explanation

`Error(0)` or a negative code, or a panic inside a macOS method (converted per request to
`EIO`). Check the backend's error values first. A panic elsewhere is not contained.

### The directory is empty in the mounted view

`read_directory` returned `eof: true` on the first call, never pushed an entry, or pushed every
entry with `next_cookie: 0`. On macOS, pushing `.` or `..` shifts every cookie by two; do not
push dot entries. On Linux the adapter adds no dot entries, so a missing listing is your page.

### `ENOENT` for an inode that exists

`metadata` was called for an inode the backend forgot, or an inode was reused without changing
`generation`. Return `Error::STALE` for an invalidated inode so the kernel looks the path up
again.

### Duplicate entries after a mutation

The directory verifier did not change, so the kernel reused a cached page while your cookies
pointed at shifted entries. Bump the directory version on every entry-set mutation, or keep
cookies stable across it. Returning `STALE` is safer than silently restarting.

### Readdir keeps restarting with `STALE`

The verifier never matches. A common cause is generating a new verifier for every page or for
every call. Use one stable per-directory version, and only change it when the entry set changes.

### Hard links fail

There is no `link` method. macOS replies `ENOTSUP` and the volume reports a maximum link count of
`1`.

### The mount is not visible, or disappears immediately

The `MountSession` was dropped. It owns the mount and the service; when it goes out of scope the
volume unmounts. Keep it in a variable or thread that lives for as long as the mount should.

## Next

- [Platform setup](platform-setup) for the prerequisites behind these messages.
- [Mounting and lifecycle](mounting) for session ownership and options.
- [Testing a backend](testing) to reproduce enumeration bugs without a mount.
