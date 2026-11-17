import { defineWranglerConfig } from "wrangler/experimental-config";

/**
 * Build settings for the bundler that `cf` runs. Runtime configuration lives in
 * `cloudflare.config.ts`.
 */
export default defineWranglerConfig({
  assetsDirectory: "./doc_build",
});
