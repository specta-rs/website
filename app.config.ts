import { defineConfig } from "@solidjs/start/config";
import { withSolidBase } from "@kobalte/solidbase/config";

export default defineConfig(
  withSolidBase(
    {
      server: {
        compatibilityDate: "2024-12-05",
      },
    },
    {
      title: "specta-rs",
      description: "Rust crates for building better web apps",
      themeConfig: {},
    },
  ),
);
