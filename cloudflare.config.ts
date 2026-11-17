import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "specta-website",
    compatibilityDate: "2025-12-31",
    entrypoint: "./worker/index.ts",
    assets: {
      htmlHandling: "drop-trailing-slash",
      notFoundHandling: "404-page",
      // Route documentation through the Worker so it can negotiate Markdown and
      // keep the old `.mdx` URLs working. Static assets are served by the Asset
      // Worker after the Worker passes the request through.
      runWorkerFirst: [
        "/ph_ebbd7f/*",
        "/favicon.ico",
        "/docs",
        "/docs/*",
        "/about",
        "/consulting",
      ],
    },
    domains: ["specta.dev"],
    observability: {
      enabled: true,
    },
    // Pull request previews use the same Worker with preview-specific hosting;
    // the bare workers.dev route stays disabled.
    previewUrls: true,
    workersDev: false,
    env: {
      ASSETS: bindings.assets(),
    },
  },
});
