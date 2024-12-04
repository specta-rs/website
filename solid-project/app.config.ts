import { defineConfig } from "@solidjs/start/config";
import { createWithSolidBase } from "@kobalte/solidbase/config";
import defaultTheme from "./src/theme";

const withSolidBase = createWithSolidBase(defaultTheme);

export default defineConfig(withSolidBase({}, {}));
