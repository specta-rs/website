"use client";

import { ArrowUpRight, Braces, FileCode2, Search } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "waku/router/client";
import catalog from "@/lib/reference-catalog.json";
import {
  filterSymbols,
  projectNames,
  selectedSymbol,
  symbolAnchor,
  type ReferenceData,
  type ReferencePackage,
} from "@/lib/reference";

const packages = catalog.packages as ReferencePackage[];

function readSelection(query: string, hash: string) {
  const params = new URLSearchParams(query);
  const requested = packages.find((item) => item.id === params.get("package"));
  const project = params.get("project");
  const pkg =
    requested ||
    packages.find((item) => item.project === project) ||
    packages[0];
  const version = pkg.versions.find(
    (item) => item.version === params.get("version"),
  );
  return {
    packageId: pkg.id,
    version: version?.version || pkg.defaultVersion,
    hash: hash.replace(/^#/, ""),
  };
}

const controlClass =
  "w-full min-w-0 rounded-lg border bg-fd-background px-3 py-2 text-sm text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-ring";

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ApiReference() {
  const router = useRouter();
  const ready = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const selection = readSelection(
    ready ? router.query : "",
    ready ? router.hash : "",
  );
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState({ route: "", value: "" });
  const routeKey = `${router.query}#${router.hash}`;
  const query = filter.route === routeKey ? filter.value : "";
  const [loaded, setLoaded] = useState<{
    key: string;
    data?: ReferenceData;
    error?: boolean;
  } | null>(null);
  const pkg = packages.find((item) => item.id === selection.packageId)!;
  const version = pkg.versions.find(
    (item) => item.version === selection.version,
  )!;

  const requestKey = `${version.data}:${attempt}`;
  const data = loaded?.key === requestKey ? loaded.data : undefined;
  const error = loaded?.key === requestKey && loaded.error;
  const loading = Boolean(version.data) && loaded?.key !== requestKey;

  useEffect(() => {
    if (!ready || !version.data) return;
    const controller = new AbortController();
    fetch(version.data, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Reference unavailable");
        return response.json() as Promise<ReferenceData>;
      })
      .then((result) => {
        if (!controller.signal.aborted)
          setLoaded({ key: requestKey, data: result });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoaded({ key: requestKey, error: true });
      });
    return () => controller.abort();
  }, [ready, version.data, requestKey]);

  function navigate(packageId: string, release?: string, hash = "") {
    const next = packages.find((item) => item.id === packageId)!;
    const selectedVersion = release || next.defaultVersion;
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      package: packageId,
      version: selectedVersion,
    }).toString();
    url.hash = hash;
    void router.push(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
    setFilter({ route: routeKey, value: "" });
  }

  const symbols = data?.symbols || [];
  const matches = filterSymbols(symbols, query);
  // Filtering narrows navigation, not the explicitly linked symbol. This also
  // keeps same-URL global-search selections visible when the router is a no-op.
  const selected = selectedSymbol(symbols, query, selection.hash);
  const isRust = pkg.language === "rust";
  const groups = packages.filter(
    (item) => item.project === pkg.project && item.language === pkg.language,
  );
  const selectPackage = (project: string, language: string) => {
    const next =
      packages.find(
        (item) => item.project === project && item.language === language,
      ) || packages.find((item) => item.project === project)!;
    navigate(next.id);
  };

  return (
    <div className="not-prose my-6 min-w-0 space-y-6">
      <div className="rounded-xl border bg-fd-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-xs font-medium text-fd-muted-foreground">
            <span>Project</span>
            <select
              className={controlClass}
              value={pkg.project}
              onChange={(event) =>
                selectPackage(event.target.value, pkg.language)
              }
            >
              {Object.entries(projectNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-fd-muted-foreground">
            <span>Language</span>
            <select
              className={controlClass}
              value={pkg.language}
              onChange={(event) =>
                selectPackage(pkg.project, event.target.value)
              }
            >
              <option value="rust">Rust</option>
              {packages.some(
                (item) =>
                  item.project === pkg.project &&
                  item.language === "typescript",
              ) && <option value="typescript">TypeScript</option>}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-fd-muted-foreground">
            <span>{isRust ? "Crate" : "Package / bindings"}</span>
            <select
              className={controlClass}
              value={pkg.id}
              onChange={(event) => navigate(event.target.value)}
            >
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-fd-muted-foreground">
            <span>Version</span>
            <select
              className={controlClass}
              value={version.version}
              onChange={(event) =>
                navigate(pkg.id, event.target.value, selection.hash)
              }
            >
              {pkg.versions.map((item) => (
                <option key={item.version} value={item.version}>
                  {item.version}
                  {item.version === pkg.defaultVersion ? " (default)" : ""}
                  {item.yanked ? " (yanked)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-fd-muted-foreground">
            {isRust ? (
              <Braces className="size-4" />
            ) : (
              <FileCode2 className="size-4" />
            )}
            <span>{isRust ? "Rust" : "TypeScript"} reference</span>
            <span className="rounded-md border px-1.5 py-0.5">
              {version.version}
            </span>
          </div>
          <h2 className="break-words text-xl font-semibold">{pkg.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-fd-muted-foreground">
            {isRust
              ? "Find a symbol, then open its full documentation on docs.rs."
              : pkg.project === "tauri-specta"
                ? "Representative generated bindings. Your commands, events, and types depend on your Rust application."
                : version.version.startsWith("unreleased-")
                  ? "Public exports from an unpublished, commit-pinned source snapshot. This is not a released npm version."
                  : "Public exports and type signatures from the published package."}
          </p>
        </div>
        <a
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium underline underline-offset-4"
          href={version.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {isRust ? "Open docs.rs" : "View source"}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      {loading ? (
        <p
          role="status"
          className="py-10 text-center text-sm text-fd-muted-foreground"
        >
          Loading reference…
        </p>
      ) : error ? (
        <div role="alert" className="rounded-xl border p-6 text-sm">
          <p>
            Could not load this reference. You can still open the original
            documentation above.
          </p>
          <button
            className="mt-3 rounded-md border px-3 py-1.5"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : !version.data ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-fd-muted-foreground">
          <p className="font-medium text-fd-foreground">
            This version is not indexed locally.
          </p>
          <p className="mt-2">
            {version.unavailable ||
              "An API index is not available for this release."}{" "}
            Use the source link above to browse this exact version.
          </p>
        </div>
      ) : (
        <>
          {data?.description && (
            <p className="rounded-lg border bg-fd-secondary/40 p-4 text-sm leading-relaxed text-fd-muted-foreground">
              {data.description}
            </p>
          )}
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-fd-muted-foreground" />
            <input
              aria-label="Filter symbols"
              type="search"
              value={query}
              onChange={(event) =>
                setFilter({ route: routeKey, value: event.target.value })
              }
              placeholder={`Search ${pkg.name} symbols…`}
              className={`${controlClass} pl-9`}
            />
          </label>
          <div
            className="flex items-center justify-between text-xs text-fd-muted-foreground"
            role="status"
          >
            <span>
              {matches.length} {matches.length === 1 ? "symbol" : "symbols"}
              {query && ` matching “${query}”`}
            </span>
            <span>
              {isRust ? "Results open docs.rs ↗" : "Generated from source"}
            </span>
          </div>
          {matches.length === 0 && (isRust || !selected) ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-fd-muted-foreground">
              No symbols match. Try a symbol name or a shorter search.
            </p>
          ) : isRust ? (
            <div className="overflow-hidden rounded-xl border">
              {matches.slice(0, 100).map((symbol) => (
                <a
                  key={`${symbol.name}:${symbol.url}`}
                  href={symbol.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex items-start gap-3 border-b p-4 last:border-b-0 hover:bg-fd-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="break-all font-mono text-sm font-medium">
                        {symbol.name}
                      </span>
                      <span className="text-xs text-fd-muted-foreground">
                        {symbol.kind}
                      </span>
                    </div>
                    {symbol.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-fd-muted-foreground">
                        {symbol.description}
                      </p>
                    )}
                  </div>
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground group-hover:text-fd-foreground" />
                </a>
              ))}
              {matches.length > 100 && (
                <p className="p-4 text-xs text-fd-muted-foreground">
                  Showing the first 100 symbols. Narrow your search to find
                  more.
                </p>
              )}
            </div>
          ) : (
            <div className="grid min-w-0 overflow-hidden rounded-xl border lg:grid-cols-[230px_minmax(0,1fr)]">
              <nav
                aria-label="API symbols"
                className="max-h-64 overflow-y-auto border-b p-2 lg:max-h-[650px] lg:border-r lg:border-b-0"
              >
                {matches.length === 0 && (
                  <p className="p-3 text-xs text-fd-muted-foreground">
                    No symbols match this filter.
                  </p>
                )}
                {matches.map((symbol) => (
                  <a
                    key={`${symbol.name}:${symbol.url}`}
                    href={symbol.url}
                    aria-current={selected === symbol ? "true" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(pkg.id, version.version, symbolAnchor(symbol));
                    }}
                    className={`block break-all rounded-md px-3 py-2 font-mono text-xs ${selected === symbol ? "bg-fd-accent font-semibold text-fd-accent-foreground" : "text-fd-muted-foreground hover:bg-fd-accent"}`}
                  >
                    {symbol.name.split(":").at(-1)}
                    <span className="mt-0.5 block font-sans text-[11px] font-normal opacity-70">
                      {symbol.kind}
                      {symbol.name.includes(":") &&
                        ` · ${symbol.name.slice(0, symbol.name.lastIndexOf(":"))}`}
                    </span>
                  </a>
                ))}
              </nav>
              {selected && (
                <article
                  aria-label={`${selected.name} reference`}
                  className="min-w-0 p-5 sm:p-6"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-fd-muted-foreground">
                    {selected.kind}
                  </span>
                  <h3 className="mt-2 break-all font-mono text-lg font-semibold">
                    {selected.name.split(":").at(-1)}
                  </h3>
                  {selected.name.includes(":") && (
                    <p className="mt-1 break-all text-xs text-fd-muted-foreground">
                      {selected.name.slice(0, selected.name.lastIndexOf(":"))}
                    </p>
                  )}
                  {selected.signature && (
                    <pre className="mt-5 max-h-[500px] overflow-auto rounded-lg border bg-fd-secondary/50 p-4 text-xs leading-relaxed">
                      <code>{selected.signature}</code>
                    </pre>
                  )}
                  {selected.description ? (
                    <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-fd-muted-foreground">
                      {selected.description}
                    </p>
                  ) : (
                    <p className="mt-5 text-sm text-fd-muted-foreground">
                      No description is provided by this release. See the type
                      signature above and the usage guides.
                    </p>
                  )}
                  {selected.sourceUrl && (
                    <a
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-5 inline-flex items-center gap-1 text-xs underline underline-offset-4"
                    >
                      View original source
                      <ArrowUpRight className="size-3" />
                    </a>
                  )}
                </article>
              )}
            </div>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-fd-muted-foreground">
        Versions are independent for each package or crate. Historical releases
        remain selectable; releases without extractable documentation link to
        their original source. Site-wide search uses the default version of each
        reference.
      </p>
    </div>
  );
}
