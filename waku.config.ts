import { type Config, defineConfig } from "waku/config";
import mdx from "fumadocs-mdx/vite";
import * as MdxConfig from "./source.config.js";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import nodeLoaderCloudflare from "@hiogawa/node-loader-cloudflare/vite";
import type { UserConfig } from "vite";

export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      mdx(MdxConfig),
      tsconfigPaths(),
      nodeLoaderCloudflare({
        environments: ["rsc"],
        build: true,
        // https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy
        getPlatformProxyOptions: {
          persist: {
            path: ".wrangler/state/v3",
          },
        },
      }),
    ],
  } satisfies UserConfig as Config["vite"],
});
