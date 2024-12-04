import { defineConfig } from "@solidjs/start/config";
import { withSolidBase } from "@kobalte/solidbase/config";

export default defineConfig(
	withSolidBase(
		{},
		{
			title: "specta-rs",
			description: "Rust crates for building better web apps",
			themeConfig: {},
		},
	),
);
