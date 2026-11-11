---
title: "Raw events"
description: "Observe native requests with borrowed platform payloads and optional rejection."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/raw-events.md"
---

Raw events are an opt-in escape hatch. They let a backend see the platform's own request without
forcing every filesystem through an allocation-heavy universal object.

## Enabling the hook

Return a non-empty mask from `raw_event_mask` and implement `raw_event`:

```rust
use fsk::raw::{Operation, RawEventMask};

fn raw_event_mask(&self) -> RawEventMask {
    RawEventMask::operation(Operation::Write)
        .union(RawEventMask::operation(Operation::Notification))
}
```

`RawEventMask` is a `u64` bitset with `NONE`, `ALL`, `operation`, `contains` and `union`. The
default is `NONE`.

The adapter reads the mask once when the volume starts and caches it. Changing the mask later has
no effect until you remount. With an empty mask there is one bit test per operation, no event is
constructed, and the hook is never called.

## The event

```rust
pub struct RawEvent<'a> {
    pub platform: Platform,
    pub operation: Operation,
    pub caller: Caller,
    pub native: NativeRequest<'a>,
    pub buffer: Option<RawBuffer<'a>>,
}

pub struct Caller {
    pub process_id: u32,
    pub user_id: u32,
    pub group_id: u32,
}
```

`platform` is `MacOS`, `Linux` or `Windows`. `operation` is the portable operation being
performed, plus four native-only values. `caller` is filled where the platform provides process
identity; macOS leaves it zeroed and Windows fills only `process_id`. `buffer` is present for
data-carrying operations: read buffers are writable, write buffers are read-only.

## Operations

| Operation       | Kind        |
| --------------- | ----------- |
| `StatFs`        | portable    |
| `Metadata`      | portable    |
| `SetMetadata`   | portable    |
| `Lookup`        | portable    |
| `ReadDirectory` | portable    |
| `Read`          | portable    |
| `Write`         | portable    |
| `Create`        | portable    |
| `Symlink`       | portable    |
| `ReadLink`      | portable    |
| `Remove`        | portable    |
| `Rename`        | portable    |
| `Synchronize`   | portable    |
| `Open`          | native-only |
| `Close`         | native-only |
| `Notification`  | native-only |
| `Cancel`        | native-only |

The portable names mirror the trait methods. `Notification` reports a platform change such as a
Windows write to the ProjFS cache. `Cancel` reports a cancelled command and has no reply.

## Continue or reject

`raw_event` runs before the portable operation, after the adapter has decoded enough request
identity to build the event:

```rust
pub enum RawOutcome {
    Continue,
    Reject(Error),
}
```

`Continue` dispatches normally. `Reject(error)` skips the operation and fails the request, which
is useful for auditing without duplicating backend logic:

```rust
if self.read_only && matches!(event.operation, Operation::Write | Operation::Create) {
    return RawOutcome::Reject(Error(30)); // EROFS
}
```

## Platform payloads

### macOS

```rust
NativeRequest::MacOS {
    request_id: u64,
    item_id: u64,
    flags: u64,
    payload: &[u8],
}
```

`request_id` is the IPC frame identifier. `item_id` is the first eight payload bytes decoded as a
little-endian `u64`, or `0` when the payload is shorter. `flags` is reserved and currently always
`0`. `payload` is the whole IPC request body. `buffer` is always `None`, because FSKit runs out of
process and no read or write data crosses the bridge. The payload layout is bridge-internal and
may change between SDK versions; prefer the portable operations.

### Linux

```rust
NativeRequest::Linux {
    request: NonNull<c_void>,
    unique: u64,
    file_handle: u64,
    flags: u32,
}
```

`request` points at the live `fuser::Request` and is usable only synchronously. `unique` is the
FUSE identifier, `file_handle` is the adapter's handle (`0` when none), and `flags` is the raw
`OpenFlags` value. `caller` carries pid, uid and gid. A read carries a writable buffer over the
dispatcher's read buffer; a write carries a read-only buffer over the kernel's input.

### Windows

```rust
NativeRequest::Windows {
    callback_data: NonNull<c_void>,
    namespace_context: isize,
    command_id: i32,
    flags: u32,
}
```

`callback_data` is the live `PRJ_CALLBACK_DATA` pointer, `namespace_context` is that pointer's
virtualization context as an integer, and `command_id` is the ProjFS command id. `flags` is the
callback data flags, OR-ed with the raw `PRJ_NOTIFICATION` value for notification events.
`caller.process_id` comes from `TriggeringProcessId`; uid and gid are `0`. Read hydration carries
a writable buffer over the ProjFS-aligned output. `Cancel` has no reply.

## Lifetime rules

Every pointer and buffer is valid only for the synchronous hook call:

- Copy anything you need to keep. Do not store a `RawEvent`, a `RawBuffer`, or any pointer from
  `NativeRequest`.
- Do not block while holding the borrow. A long operation delays the request and can stall a
  ProjFS callback thread.
- Do not call back into the mount from the hook.

`RawBuffer` exposes `len`, `is_empty`, `is_writable`, `unsafe as_bytes` and `unsafe
as_bytes_mut`. Bounds are already checked by the adapter; the `unsafe` is about the native
allocation and platform initialization rules.

## A complete hook

```rust
use fsk::{
    Error, Filesystem,
    raw::{NativeRequest, Operation, RawEvent, RawEventMask, RawOutcome},
};

impl Filesystem for Audited {
    fn raw_event_mask(&self) -> RawEventMask {
        RawEventMask::operation(Operation::Write)
            .union(RawEventMask::operation(Operation::Create))
            .union(RawEventMask::operation(Operation::Read))
            .union(RawEventMask::operation(Operation::Notification))
    }

    fn raw_event(&self, event: RawEvent<'_>) -> RawOutcome {
        if self.read_only && matches!(event.operation, Operation::Write | Operation::Create) {
            return RawOutcome::Reject(Error(30)); // EROFS
        }

        match &event.native {
            NativeRequest::MacOS {
                request_id,
                item_id,
                payload,
                ..
            } => self.audit.macos(*request_id, *item_id, payload.len()),
            NativeRequest::Linux {
                unique,
                file_handle,
                flags,
                ..
            } => {
                if let Some(buffer) = event.buffer.as_ref() {
                    // SAFETY: the buffer is valid for this call only.
                    let bytes = unsafe { buffer.as_bytes() };
                    self.audit
                        .linux(*unique, *file_handle, *flags, bytes.len());
                }
            }
            NativeRequest::Windows {
                command_id, flags, ..
            } => self.audit.windows(*command_id, *flags),
        }

        RawOutcome::Continue
    }
}
```

Keep the hook short. If it needs to do work, copy the fields you need into a queue and let a
worker handle the rest. There is no data copy on the hot path: Linux and Windows hand you a view
over the callback buffer, and macOS attaches no buffer at all.

## Next

- [Mounting and lifecycle](mounting) for where the mask is captured.
- [Testing a backend](testing) for exercising a hook without a kernel.
- [Troubleshooting](troubleshooting) for `ERROR_INVALID_FUNCTION` and other native errors.
