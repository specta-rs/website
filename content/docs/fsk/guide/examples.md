---
title: "Examples"
description: "Four complete backends: in-memory, network, GitHub and Google Drive."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/examples.md"
---

The repository ships four standalone backends. They are not part of the published `fsk` crate,
and each makes a different storage and consistency choice on purpose. Copy the pattern that fits
your data, not the whole design.

| Example             | Crate                   | Demonstrates                                                |
| ------------------- | ----------------------- | ----------------------------------------------------------- |
| `memory-backend`    | `fsk-memory-backend`    | The full writable trait, sharded state, cookies             |
| `network-backend`   | `fsk-network-backend`   | `NetworkFilesystem`, lazy reads, local-file leases          |
| `github-filesystem` | `fsk-github-filesystem` | Read-only API tree, pagination, atomic downloads            |
| `google-drive`      | `fsk-google-drive`      | Drive API, lazy bytes, workspace export, conditional writes |

All four call `fsk::ensure_authorization()` before mounting, so the platform prerequisites apply.
Run them from the repository root.

## memory-backend

A complete writable in-memory filesystem, intended as the reference implementation of the trait.

**What it shows.** Inodes live in a sharded `DashMap`; each node is behind an `RwLock`; one short
global mutex makes cross-directory rename atomic without serialising reads. Directory slots are
stable, so a cookie is a slot index. Each directory carries a `version` used as the verifier and
bumped on every mutation. Capacity is tracked atomically, and failed growth is rolled back.
Sparse writes report a block-rounded `allocated_size`. Namespace changes are logged as
`[fs] create|mkdir|symlink|write|set|remove|rmdir|rename …`.

**Storage and consistency.** Everything is in memory and disappears on exit. Locks are per node;
the namespace lock is only held across rename and similar multi-directory changes.

```sh
cargo run -p fsk-memory-backend -- /path/to/mount
```

No environment variables. The example creates the mount directory on startup and removes it on
exit, so the path must not already exist. It mounts until Ctrl-C and then unmounts cleanly.

**Platform notes.** The full write path runs on macOS and Linux. On Windows, ProjFS keeps edits
in its cache and does not call `write`, `create`, `remove` or `rename`.

**What to copy.** The slot directory plus verifier pattern, the per-node lock layout, and the
atomic capacity check. Do not copy the lack of persistence.

## network-backend

A minimal immutable network filesystem that shows the lease path end to end.

**What it shows.** It implements `NetworkFilesystem: Filesystem` with two files. `origin.txt` is
served lazily through `read`. `downloaded.txt` is materialized into
`local_file_directory()/network-backend/downloaded.txt` and returned as
`NetworkFile::Local(LocalFile::new(path, 1))` for inode `3`. `close_file` is the hook for
last-access tracking and eviction. The content of `origin.txt` comes from the second CLI
argument.

**Storage and consistency.** The "remote" is a byte buffer supplied at startup; the local file is
written once and never changes. There is no cache eviction because there is only one materialized
file.

```sh
cargo run -p fsk-network-backend -- /path/to/mount "Content returned by origin.txt"
```

No required environment variables; the second argument is optional and sets the remote content.

**Platform notes.** macOS needs the App Group path from `local_file_directory()`, which this
example uses. On Linux the same path resolves to the process temp directory. On Windows
`open_file` is not consulted; ProjFS hydrates into its own cache.

**What to copy.** The `LocalFile` lease and the `local_file_directory()` subdirectory. Add a real
eviction policy before using it for a large tree.

## github-filesystem

A read-only GitHub tree with lazy API reads and a disk cache.

**What it shows.** The mount is `/<owner>/<repository>/` and shows only the default branch.
Repository discovery is paginated at 100 entries. Namespace data is fetched from the REST API on
demand. A file read downloads its blob to a temporary file and renames it into place atomically;
later opens use `LocalFile` and bypass the userspace read path. Cache entries are keyed by
repository, path and blob SHA, so changed content never aliases stale bytes.

**Storage and consistency.** Read-only. The cache is an LRU limited by bytes (default 1 GiB) with
age-based eviction (default 7 days). Cleanup runs at startup and after leases close, and never
removes a file that is currently open. Offline reads work for already materialized files;
uncached namespace or data requests fail with an I/O error.

```sh
GITHUB_TOKEN=github_pat_... \
  cargo run -p fsk-github-filesystem -- /path/to/mount
```

`GITHUB_TOKEN` is required. `GHFS_CACHE_DIR`, `GHFS_MAX_CACHE_BYTES` and `GHFS_MAX_IDLE_SECS` are
the environment equivalents of the flags:

```text
--cache-dir PATH          cache location (platform cache directory by default)
--max-cache-bytes BYTES   LRU size limit (default: 1073741824)
--max-idle-secs SECONDS   remove files untouched this long (default: 604800)
--download-on-list        download files when their directory is listed
--api-url URL             GitHub API base URL (default: https://api.github.com)
```

**Platform notes.** Read-only on every platform. Installation tokens fall back to
`/installation/repositories` when `/user/repos` is unavailable, which is how CI runs without a
personal token.

**What to copy.** Namespace pagination, a cache key that includes the content identity, and the
temporary-file-plus-atomic-rename download.

## google-drive

A Drive mount that exposes `My Drive`, `Shared with me` and every shared drive available to the
account.

**What it shows.** File bytes are fetched lazily on first access. Google Workspace documents are
exported to `.docx`, `.xlsx`, `.pptx` or `.pdf` and exposed read-only, because Drive does not
publish their exported byte lengths. Ordinary files are writable when Drive reports
`canModifyContent`; everything else is read-only through the normal permission bits.

**Storage and consistency.** The tree is indexed at mount time and file contents are buffered in
memory, capped at 256 MiB per file. Uploads use Drive revisions and `If-Match` ETags, so a
concurrent remote change is rejected instead of overwritten. On macOS and Linux, writes upload
to Drive. On Windows, ProjFS keeps edits in its local cache; read-only files still receive the
Windows read-only attribute.

```sh
export GOOGLE_DRIVE_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)"
cargo run -p fsk-google-drive -- /path/to/mount
```

The token needs the `https://www.googleapis.com/auth/drive` scope for writes. Access tokens are
short-lived, so restart with a fresh one after expiry. For unattended use, provide the refresh
flow instead:

```sh
GOOGLE_CLIENT_ID=... \
GOOGLE_CLIENT_SECRET=... \
GOOGLE_DRIVE_REFRESH_TOKEN=... \
cargo run -p fsk-google-drive -- /path/to/mount
```

`GOOGLE_DRIVE_ACCESS_TOKEN` takes precedence when both forms are set.

**What to copy.** The conditional-write check and the export policy for documents whose native
format is not a byte stream.

## Next

- [Testing a backend](testing) for the unit and live-mount tests these examples use.
- [Network filesystems](network-filesystems) for the lease rules in detail.
- [Troubleshooting](troubleshooting) when an example mounts but behaves unexpectedly.
