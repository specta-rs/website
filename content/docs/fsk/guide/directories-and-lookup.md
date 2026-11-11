---
title: "Directories and lookup"
description: "Name resolution, streamed directory enumeration, cookies and verifiers."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/directories-and-lookup.md"
---

A backend never returns a directory listing as a vector. It resolves one name at a time with
`lookup`, and streams entries into a sink with `read_directory`. Both are called constantly, so
their contracts are worth getting exactly right.

## Lookup

`lookup(parent, name)` maps one name in one directory to `(inode, kind)`.

```rust
fn lookup(&self, parent: u64, name: &[u8]) -> Result<(u64, FileType)> {
    let node = self.node(parent)?;
    let directory = node.directory().ok_or(Error(20))?; // ENOTDIR
    let inode = *directory.by_name.get(name).ok_or(Error(2))?; // ENOENT
    Ok((inode, self.kind(inode)?))
}
```

Choose the error deliberately:

| Situation                    | Return                                  |
| ---------------------------- | --------------------------------------- |
| `parent` is not a directory  | `Error(20)` (`ENOTDIR`)                 |
| The name is not present      | `Error(2)` (`ENOENT`)                   |
| `parent` itself is gone      | `Error::STALE`                          |
| The directory cannot be read | `Error::IO` or a specific positive code |

The kind is cached alongside the inode, so it must agree with `metadata(inode).kind`. If a name
can refer to different objects over time, the inode must change; do not return the same inode
with a different kind.

`lookup` is not called for `.` or `..`, and the name never contains a separator. You can treat
it as an exact key lookup in the parent directory.

## Streaming a directory

`read_directory` is pull-based. The adapter supplies a sink sized to the kernel's buffer; you
push entries until it refuses more:

```rust
pub trait DirectorySink {
    fn push(&mut self, entry: DirectoryEntry<'_>) -> bool;
}

pub struct DirectoryEntry<'a> {
    pub name: &'a [u8],
    pub inode: u64,
    pub kind: FileType,
    pub next_cookie: u64,
}

pub struct ReadDirectoryResult {
    pub verifier: u64,
    pub next_cookie: u64,
    pub eof: bool,
}
```

`push` returns `false` when the output buffer is full. That entry was not accepted: stop
pushing, and resume from the last entry that was. `ReadDirectoryResult` closes the call:

- `verifier` identifies the directory state this page came from.
- `next_cookie` is the cursor for the next call.
- `eof` says whether the enumeration is finished.

Never allocate the full listing first. A directory with a million entries should cost one page
of memory.

## Cookies

A cookie is opaque to the kernel and compared only by your backend. The rules:

- `0` starts an enumeration; the first entry you push must have a non-zero `next_cookie`.
- `next_cookie` is the resume point _after_ that entry, not the cookie that produced it.
- Cookies must advance. Returning the same cookie with `eof: false` makes the kernel call
  again forever.
- They need not be contiguous or small. An index, a byte offset or a monotonic counter all work.
- A cookie must never be reused for a different entry while an enumeration could be in flight.

A stable slot array makes this trivial: keep `Vec<Option<Entry>>` per directory, use the slot
index as the cookie, and leave holes when entries are removed. The memory backend does exactly
that.

## Verifiers

The verifier is a directory version. Return it with every page, and validate the value the
kernel passes back:

```rust
if verifier != 0 && verifier != directory.version {
    return Err(Error::STALE);
}
```

Bump `directory.version` on every mutation that changes the entry set: `create`, `remove`,
`rename` into or out of the directory, and a successful replacement. Do not bump it for a file
content write; that changes the file, not the listing.

Returning `STALE` is better than silently restarting, because a restart can duplicate or skip
entries in the caller's view. The kernel discards its partial listing and starts again from
cookie `0`.

Platform reality differs:

| Platform | Verifier handling                                                   |
| -------- | ------------------------------------------------------------------- |
| macOS    | Passed back on each call; return `STALE` to restart the enumeration |
| Windows  | Carried from one page to the next while draining a directory        |
| Linux    | The adapter always passes `0` and ignores the returned value        |

So the verifier is cheap insurance on macOS and Windows, and unused on Linux. Implement it
anyway; it costs one integer per directory.

## Platform differences

The same trait maps onto three different enumeration models.

**macOS** synthesises `.` and `..` itself and offsets your cookies by two. Do not push dot
entries, and do not compensate for the offset; the adapter translates. A page holds at most 512
entries or 64 KiB of names. If a page produces no entries and does not set `eof`, the bridge
returns `ERANGE` so the caller grows its buffer.

**Windows** drains the whole directory in one callback by calling `read_directory` repeatedly.
Every non-final page must satisfy `next_cookie > cookie`, or the enumeration fails with
`ERROR_INVALID_PARAMETER`; a backend that rewinds would otherwise loop forever. ProjFS then
sorts the collected names in its own order, so your ordering is not preserved on Windows.

**Linux** packs entries into the FUSE reply buffer. It forwards exactly the entries you push
and adds no dot entries of its own. The adapter also ignores `eof`; the reply is complete when
the sink is full or your loop ends.

## A directory in pages

This is the memory backend's shape, with the state kept in one struct:

```rust
fn read_directory(
    &self,
    inode: u64,
    cookie: u64,
    verifier: u64,
    sink: &mut dyn DirectorySink,
) -> Result<ReadDirectoryResult> {
    let node = self.node(inode)?;
    let state = node.state.read();
    let NodeData::Directory(dir) = &state.data else {
        return Err(Error(20)); // ENOTDIR
    };
    if verifier != 0 && verifier != dir.version {
        return Err(Error::STALE);
    }

    let start = usize::try_from(cookie).map_err(|_| Error::INVALID)?;
    if start > dir.slots.len() {
        return Err(Error::INVALID);
    }

    let mut resume = cookie;
    for (index, slot) in dir.slots.iter().enumerate().skip(start) {
        let Some(entry) = slot else { continue };
        let next = index as u64 + 1;
        if !sink.push(DirectoryEntry {
            name: &entry.name,
            inode: entry.inode,
            kind: entry.kind,
            next_cookie: next,
        }) {
            return Ok(ReadDirectoryResult {
                verifier: dir.version,
                next_cookie: resume,
                eof: false,
            });
        }
        resume = next;
    }

    Ok(ReadDirectoryResult {
        verifier: dir.version,
        next_cookie: resume,
        eof: true,
    })
}
```

The first call gets `cookie == 0` and starts at slot 0. Each accepted entry advances `resume`.
When the sink fills, the call returns the cursor of the last accepted entry, and the next call
continues from the slot that did not fit. The final call returns `eof: true`.

## Common mistakes

- **Returning `next_cookie: 0` on the first page.** The kernel restarts from the beginning.
- **Advancing the cookie before a successful push.** The skipped entry never reaches the user.
- **Reusing cookies after a mutation.** Either bump the verifier and return `STALE`, or make
  cookies stable across the mutation.
- **Ignoring `cookie` and always enumerating from the start.** Large directories blow the
  buffer and loop.
- **Setting `eof: true` on a full page.** The last entries are silently dropped.
- **Pushing `.` and `..` on macOS.** They appear twice and shift every cookie.

## Next

- [Reading and writing](reading-and-writing) covers the data path and metadata updates.
- [Implementing a filesystem](implementing-a-filesystem) has the full trait reference.
- [Testing a backend](testing) shows how to test pagination without a mount.
