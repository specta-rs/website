# Rust reference snapshots

Run `node scripts/reference/rust.mjs` to regenerate the committed catalog at
`reference/rust.json` and per-release symbol files in `reference/rust/`.
The website consumes these files without network access at build time.

The generator uses Node built-ins, with optional Python 3 for decoding docs.rs
BZIP2 ZIP archives. Without Python, it fetches individual HTML pages instead.
It reads the complete crates.io release
list, preserves prereleases and yanked releases, and sorts versions using SemVer
precedence. The default is the newest non-yanked version with indexed docs.

For each release it downloads docs.rs rustdoc JSON (`/crate/<crate>/<version>/json.gz`)
and the rustdoc `all.html` item list. The JSON visitor follows public modules and
local reexports (including renamed and glob reexports), indexes inherent methods,
trait declarations, public fields, enum variants and their named fields, and excludes private,
`doc(hidden)`, dependency, auto-trait and blanket-implementation items. The HTML
list supplies authoritative item URLs when present. The generator also reads item
pages for published inline reexports missing from JSON (such as the `Type` derive
macro). It does not enumerate foreign crates or their dependency indexes.

When rustdoc JSON is missing, the generator uses `all.html` and public item pages
from the release's downloadable documentation archive, including their own
methods. It never extracts archive files onto disk. Releases without usable docs remain in
the catalog with an `unavailable` explanation and a version-specific docs.rs link.
`source` in a per-release file records `rustdoc-json` or `rustdoc-html`.

The HTML fallback discovers public modules by following each reachable module's
Modules listing from the crate root. It does not infer visibility from archive
directories. Inherited `Deref` methods are excluded alongside trait implementations,
including when HTML supplements a JSON snapshot's inlined reexports. Both parsers
link enum fields to rustdoc's `#variant.<variant>.field.<field>` anchors.

This is the API built by docs.rs with that release's configured features and
default target, not every possible Cargo feature/target combination. Signatures
from JSON are compact function previews rather than complete Rust declarations
(generic bounds and where clauses are not expanded). Trait implementation methods
are deliberately excluded; trait declarations and inherent methods are indexed.

Downloads use a descriptive User-Agent, three workers, globally spaced request
starts, retry/backoff for throttling/server errors, and an on-disk response cache.
The cache defaults to `.reference-cache/rust` and is not
committed. HTTP errors other than a missing document fail generation rather than
silently marking a release unavailable.

- `--cache-dir <path>`: reuse or retain a download cache.
- `--offline`: regenerate using only cached responses; fail on a cache miss.
- `--refresh`: replace cached responses, including release metadata and 404s.
- `--concurrency <1–4>`: limit release workers (default 3).
- `--crate <name>`: generate just one configured crate. This also writes a
  single-package catalog; rerun without this flag before committing.

Run tests with `node --test scripts/reference/rust.test.mjs`. Fixtures exercise
visibility, reexports, method anchors, HTML fallback, SemVer, gzip, yanks, missing
docs, offline generation and byte-for-byte reproducibility.

The docs.rs endpoint and historical JSON availability are documented at
<https://docs.rs/about/rustdoc-json>.
