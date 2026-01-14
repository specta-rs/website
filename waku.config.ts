import { type Config, defineConfig, type VitePlugin } from "waku/config";
import mdx from "fumadocs-mdx/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { DEFAULT_CATEGORY_FALLBACKS, FontaineTransform } from "fontaine";
import type { UserConfig } from "vite";
import arraybuffer from "vite-plugin-arraybuffer";
import * as MdxConfig from "./source.config.js";
import { headersPlugin } from "./src/vite-plugin-headers";

export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      mdx(MdxConfig),
      tsconfigPaths(),
      headersPlugin(),
      arraybuffer(),
      FontaineTransform.vite({
        fallbacks: DEFAULT_CATEGORY_FALLBACKS,
      }),
    ],
    optimizeDeps: {
      // https://github.com/fuma-nama/fumadocs/issues/2845#issuecomment-3707856896
      exclude: ["fumadocs-ui", "fumadocs-core", "@fumadocs/ui"],
    },
    build: {
      rollupOptions: {
        // Allow the Cloudflare build process to take care of wasm bundling.
        // TODO: Can be removed once https://github.com/wakujs/waku/issues/1245 is fixed.
        external: ["@takumi-rs/wasm/takumi_wasm_bg.wasm"],
      },
    },
  } satisfies UserConfig as Config["vite"],
});
