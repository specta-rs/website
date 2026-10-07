import { readFile, readdir, writeFile } from "node:fs/promises";

// Waku's Cloudflare adapter generates `dist/server/wrangler.json` from a fixed
// template and ignores `assets.run_worker_first` in the root `wrangler.jsonc`,
// so patch the generated deploy config after the build.
//
// We route `/docs` HTML pages through the Worker so the `accept-markdown`
// middleware can serve the markdown variant when a client sends
// `Accept: text/markdown`. The generated static files (`og.png`, `llms.mdx`)
// are negative rules, so Cloudflare serves them straight from the Asset Worker
// instead of the Waku router (which has no handler for them and would 500).
const wranglerConfigPath = new URL("../dist/server/wrangler.json", import.meta.url);

const runWorkerFirst = [
  "/docs",
  "/docs/*",
  "!/docs/**/og.png",
  "!/docs/**/llms.mdx",
  "!/docs/og.png",
  "!/docs/llms.mdx",
];

try {
  const config = JSON.parse(await readFile(wranglerConfigPath, "utf8"));
  config.assets = { ...config.assets, run_worker_first: runWorkerFirst };
  await writeFile(wranglerConfigPath, `${JSON.stringify(config, null, 2)}\n`);

  // Every non-HTML file generated under /docs must be excluded from the Worker
  // above; otherwise the Waku router has no handler for it and returns 500.
  // Fail the build if a new asset type appears so it gets a negative rule.
  const entries = await readdir(new URL("../dist/public/docs", import.meta.url), {
    recursive: true,
    withFileTypes: true,
  });
  const unhandled = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.endsWith(".html") &&
        !entry.name.endsWith("og.png") &&
        !entry.name.endsWith("llms.mdx"),
    )
    .map((entry) => entry.name);

  if (unhandled.length > 0) {
    throw new Error(
      `Unhandled static file(s) under /docs: ${unhandled.join(", ")}. Add a ` +
        "`run_worker_first` negative rule for them here and in wrangler.jsonc.",
    );
  }
} catch (error) {
  // A non-Cloudflare build (e.g. the Node adapter) does not emit this config.
  if (error?.code !== "ENOENT") throw error;
}
