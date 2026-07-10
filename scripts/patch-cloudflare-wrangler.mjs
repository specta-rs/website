import { readFile, writeFile } from "node:fs/promises";

const wranglerConfigPath = new URL("../dist/server/wrangler.json", import.meta.url);

try {
  const config = JSON.parse(await readFile(wranglerConfigPath, "utf8"));
  config.assets = {
    ...config.assets,
    run_worker_first: ["/docs", "/docs/*"],
  };

  await writeFile(wranglerConfigPath, `${JSON.stringify(config, null, 2)}\n`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
