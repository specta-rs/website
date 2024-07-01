import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";

import solidJs from "@astrojs/solid-js";

// https://astro.build/config
export default defineConfig({
	integrations: [tailwind(), solidJs()],
});
