import { type Config, defineConfig } from "waku/config";
import mdx from "fumadocs-mdx/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { UserConfig } from "vite";
import * as MdxConfig from "./source.config.js";
import { headersPlugin } from "./src/vite-plugin-headers";

export default defineConfig({
  vite: {
    plugins: [tailwindcss(), mdx(MdxConfig), tsconfigPaths(), headersPlugin()],
    optimizeDeps: {
      // https://github.com/fuma-nama/fumadocs/issues/2845#issuecomment-3707856896
      exclude: ["fumadocs-ui", "fumadocs-core", "@fumadocs/ui"],
    },
  } satisfies UserConfig as Config["vite"],
});
