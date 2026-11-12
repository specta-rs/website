---
title: "Platform setup"
description: "Install and authorize FSK.app, enable ProjFS, and check FUSE before mounting."
editUrl: "https://github.com/specta-rs/fsk/blob/main/docs/guide/platform-setup.md"
---

A mount needs host software that Cargo cannot install. The crate exposes one status check and one
setup call; everything else is a per-platform prerequisite.

## At a glance

| Platform | Requirement                                         | Setup                                                  |
| -------- | --------------------------------------------------- | ------------------------------------------------------ |
| macOS    | `FSK.app` installed and its extension enabled       | `fsk::ensure_authorization()` installs and opens it    |
| Windows  | Projected File System (`Client-ProjFS`) enabled     | Windows Features, or `ensure_authorization()` opens it |
| Linux    | FUSE available and `/dev/fuse` usable by the caller | Install `fuse3` and fix device permissions             |

## Check before you mount

`authorization_status()` answers whether the host can mount now. Most applications should let
`wait_for_authorization()` run the setup flow and block until the answer is yes:

```rust
use std::time::Duration;

fn wait_for_platform() -> std::io::Result<()> {
    // Installs FSK.app on macOS when needed, opens the setup UI, and returns
    // as soon as the extension is enabled.
    fsk::wait_for_authorization(Duration::from_secs(600))
}
```

| Status          | Meaning                                          | `requirement()`                                                          |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `NotInstalled`  | No matching companion app (macOS only)           | "install the FSK companion app with fsk::install()"                      |
| `NeedsApproval` | The component exists but a user action is needed | "enable FSK in System Settings …" / FUSE / ProjFS, depending on platform |
| `Authorized`    | The host can mount                               | `None`                                                                   |

For finer control, `authorization_status()` plus `ensure_authorization()` is the non-waiting
form. `ensure_authorization()` installs the matching macOS app when it is missing, launches it,
and opens the platform setup UI. It returns `io::ErrorKind::PermissionDenied` while setup is
still required; that error is an instruction to run the command again after the user acts, not
a failure of your code. Installation errors are propagated unchanged. Use `install()` and
`launch_app()` directly only when you want to control each step.

On other targets `authorization_status()` returns `io::ErrorKind::Unsupported`.

## macOS

The current flow is exercised on macOS 26 and macOS 27. `FSK.app` is a small setup utility that
hosts the FSKit extension. It is installed per user at:

```text
~/Library/Application Support/dev.specta.fsk/FSK.app
```

`~/Library` is hidden, so the app never appears in Applications, Launchpad, Spotlight or the
Dock. Each user gets a copy without administrator permission. The extension lives inside it at
`Contents/Extensions/FSKExtension.appex`.

```rust
#[cfg(target_os = "macos")]
fn install_app() -> std::io::Result<()> {
    match fsk::install()? {
        fsk::AppInstallOutcome::AlreadyInstalled => {}
        fsk::AppInstallOutcome::Installed => println!("installed FSK.app"),
        fsk::AppInstallOutcome::Updated => println!("updated FSK.app"),
    }
    fsk::launch_app()?;
    Ok(())
}
```

`install()` returns `AppInstallOutcome::{AlreadyInstalled, Installed, Updated}`. Use
`install_with_progress()` when the caller wants to show the download, verification and
installation phases.
`uninstall()` returns `io::Result<bool>`, where `true` means a copy was removed. With the default
destination, both also remove a legacy machine-wide `/Applications/FSK.app`; with
`FSK_APP_PATH`, they leave it alone.

Copying the bundle into place does not register the extension. It must be launched once, which
is what `launch_app()` does. `ensure_authorization()` performs both steps: it installs the
compatible release when the app is missing, then launches it. After that, the user enables it
under **System Settings → General → Login Items & Extensions → File System Extensions**. macOS
exposes no API for the switch, so this is always a manual, per-user action.

Approval is tied to the installed location, not just the bundle identifier. Migrating a
machine-wide `/Applications/FSK.app` to the per-user directory therefore requires the switch to
be enabled again, even when both apps speak the same protocol major version. `install()`
terminates a running legacy copy first, so it cannot survive the upgrade as an orphaned
process.

`launch_app()` validates the app at the destination before opening it. If the copy is missing or
speaks a different protocol major, it returns an error instead of launching a stale app; call
`install()` first (or use `ensure_authorization()`).

### Protocol compatibility

The installed app does not need to share the crate's marketing version. `authorization_status()`
reads `FSKProtocolMajor`/`FSKProtocolMinor` from the embedded extension's `Info.plist` and accepts
any app with the same protocol major version and the bundle identifier `dev.specta.fsk`. Missing
keys mean the app predates protocol metadata and speaks legacy protocol 1.0.

Because the check is protocol-based, an app whose protocol major matches is reused regardless of
its marketing version, and a newer SDK reuses an older app with the same major; both sides use the
lower of their advertised minor versions. When the major version differs, the app is reported as
not installed and `install()` replaces it. A git build between releases still downloads the last
released version, so pin your dependency version if several tools share one machine.

### Options and environment

| Variable               | Effect                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| `FSK_APP_PATH`         | Override the install, status, launch and uninstall destination        |
| `GITHUB_TOKEN`         | Resolve the release through the GitHub API, for a private release     |
| `GH_TOKEN`             | Same as `GITHUB_TOKEN`                                                |
| `FSK_RELEASE_BASE_URL` | Mirror base URL; it must serve `{base}/v{version}/FSK-v{version}.zip` |

`FSK_APP_PATH` is for development builds. It must be absolute, name the `.app` bundle itself,
contain no `..`, and end in `.app` with a name longer than that suffix. It does not change which
extension FSKit has registered: launch the app from that location once and enable it in System
Settings. If a future macOS refuses to register extensions outside Applications, set
`FSK_APP_PATH=/Applications/FSK.app`.

`install()` is synchronous and shows no UI. Run it on a background executor. Installs are
serialised in-process and across processes, and an interrupted install is recovered from its
backup before any download.

Release assets are validated before use: protocol major version, bundle identifier, `codesign
--verify --deep --strict`, signing identity `dev.specta.fsk` with team `68994Z5PT3`, and `spctl
--assess --type execute`.

## Windows

Enable **Projected File System** under **Turn Windows features on or off**, or as administrator:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS
```

`authorization_status()` checks by loading `ProjectedFSLib.dll` from the system directory. When
it is missing, `ensure_authorization()` opens `optionalfeatures.exe` and returns
`PermissionDenied` with the exact `Enable-WindowsOptionalFeature` command.

ProjFS requires an empty virtualization root, or one that is already initialized as a
virtualization root. FSK creates the directory if it is missing, but it will not clear an
existing non-empty directory: ProjFS rejects that, and the mount returns an `io::Error`.

What the mount gives you:

- Projected metadata and content are hydrated into a Windows-managed cache on first access.
- Local edits stay in that cache. ProjFS does not call `write`, `create`, `remove` or `rename`
  on your backend.
- There is no write-back callback. If edits must reach your storage, handle the raw notification
  events and upload the cache contents yourself.
- `statfs` is never called, so report sizes through `Metadata::size`.
- Hydrated content is not evicted automatically. Use `MountSession::evict` or an
  `EvictionHandle` from `eviction_handle()` to return idle files to placeholders.
- The read-only mount option is not applied. Enforce read-only through metadata and `open_file`.

## Linux

FUSE has to be installed and usable:

```sh
sudo apt-get install -y fuse3
sudo modprobe fuse
test -c /dev/fuse
```

`authorization_status()` returns `NeedsApproval` when `/dev/fuse` is missing or is not a
character device. There is no setup UI; `ensure_authorization()` returns an error that names the
requirement.

The mounting user must be allowed to use `/dev/fuse`. In a container that usually means passing
the device through and having `fusermount3` available; user namespaces and restricted device
access are outside FSK.

## CI and headless

Only Linux mounts run in CI. The live-mount workflow installs `fuse3`, loads the module, asserts
`/dev/fuse` exists, and mounts the GitHub and Google Drive examples through FUSE.

macOS has no headless enablement path: the extension switch is a per-user System Settings
action. The Swift extension is built and unit-tested with `CODE_SIGNING_ALLOWED=NO`, but those
tests do not mount a volume. Windows CI runs the Rust test suite and Clippy; it does not start a
ProjFS projection.

## Next

- [Mounting and lifecycle](mounting) for what happens after the check passes.
- [Network filesystems](network-filesystems) for the macOS App Group constraint.
- [Troubleshooting](troubleshooting) for the exact errors these checks produce.
