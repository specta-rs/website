---
title: "Platform setup"
description: "Install and authorize FSK.app, enable ProjFS, and check FUSE before mounting."
---

A mount needs host software that Cargo cannot install. The crate exposes one status check and one
setup call; everything else is a per-platform prerequisite.

## At a glance

| Platform | Requirement                                         | Setup                                                  |
| -------- | --------------------------------------------------- | ------------------------------------------------------ |
| macOS    | `FSK.app` installed and its extension enabled       | `fsk::install()`, then `fsk::launch_app()`             |
| Windows  | Projected File System (`Client-ProjFS`) enabled     | Windows Features, or `ensure_authorization()` opens it |
| Linux    | FUSE available and `/dev/fuse` usable by the caller | Install `fuse3` and fix device permissions             |

## Check before you mount

`authorization_status()` answers whether the host can mount now:

```rust
use fsk::AuthorizationStatus;

match fsk::authorization_status()? {
    AuthorizationStatus::Authorized => {}
    AuthorizationStatus::NotInstalled => {
        // macOS only. Blocks while it downloads and verifies the release.
        #[cfg(target_os = "macos")]
        {
            let outcome = fsk::install()?;
            println!("FSK.app: {outcome:?}");
            fsk::launch_app()?;
        }
    }
    AuthorizationStatus::NeedsApproval => {
        // Opens FSK.app on macOS and optionalfeatures.exe on Windows.
        // Linux has no UI, so the error names the requirement.
        let error = fsk::ensure_authorization().unwrap_err();
        eprintln!("setup required: {error}");
    }
}
```

| Status          | Meaning                                          | `requirement()`                                                          |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `NotInstalled`  | No matching companion app (macOS only)           | "install the FSK companion app with fsk::install()"                      |
| `NeedsApproval` | The component exists but a user action is needed | "enable FSK in System Settings …" / FUSE / ProjFS, depending on platform |
| `Authorized`    | The host can mount                               | `None`                                                                   |

`ensure_authorization()` never installs anything. `NotInstalled` returns
`io::ErrorKind::NotFound`; `NeedsApproval` opens the platform UI and returns
`io::ErrorKind::PermissionDenied`. That error is an instruction to run the command again after
the user acts, not a failure of your code.

On other targets `authorization_status()` returns `io::ErrorKind::Unsupported`.

## macOS

`FSK.app` is a small setup utility that hosts the FSKit extension. It is installed per user at:

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

`install()` returns `AppInstallOutcome::{AlreadyInstalled, Installed, Updated}`.
`uninstall()` returns `io::Result<bool>`, where `true` means a copy was removed. With the default
destination, both also remove a legacy machine-wide `/Applications/FSK.app`; with
`FSK_APP_PATH`, they leave it alone.

Copying the bundle into place does not register the extension. It must be launched once, which
is what `launch_app()` does. After that, the user enables it under **System Settings → General →
Login Items & Extensions → File System Extensions**. macOS exposes no API for the switch, so this
is always a manual, per-user action.

### Version matching

The installed app must match the crate version exactly. `authorization_status()` compares
`CFBundleShortVersionString` with the crate version and the bundle identifier with
`dev.specta.fsk`.

Because the match is exact, installing an SDK built against an older release can downgrade an app
installed by a newer one. A git build between releases reports the last released version and
treats that release as current. Pin your dependency version if several tools share one machine.

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

Release assets are validated before use: version, bundle identifier, `codesign --verify --deep
--strict`, signing identity `dev.specta.fsk` with team `68994Z5PT3`, and `spctl --assess --type
execute`.

## Windows

Enable **Projected File System** under **Turn Windows features on or off**, or as administrator:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS
```

`authorization_status()` checks by loading `ProjectedFSLib.dll` from the system directory. When
it is missing, `ensure_authorization()` opens `optionalfeatures.exe` and returns
`PermissionDenied`.

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
