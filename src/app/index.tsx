import type { ParentProps } from "solid-js";

export default function Page() {
	return (
		<main class="px-4 lg:px-12 flex flex-col lg:flex-row justify-center items-center w-full h-full gap-16">
			<div class="flex flex-col gap-4">
				<h1 class="text-6xl lg:text-8xl">specta-rs</h1>
				<h2 class="text-3xl lg:text-4xl">
					Rust crates for building better web apps
				</h2>
			</div>

			<div class="flex gap-4 flex-col">
				<HeroItem name="specta" logoHref="/logo.png" logoAlt="Specta Logo">
					Export your Rust types to any language!
				</HeroItem>

				<HeroItem name="rspc" logoHref="/rspc-logo.png" logoAlt="rspc Logo">
					A framework for building typesafe web backends in Rust
				</HeroItem>

				<HeroItem
					name="tauri-specta"
					logoHref="/tauri-specta-logo.png"
					logoAlt="Tauri Specta Logo"
				>
					Completely typesafe Tauri commands and events
				</HeroItem>
			</div>
		</main>
	);
}

function HeroItem(
	props: ParentProps<{ name: string; logoHref?: string; logoAlt: string }>,
) {
	return (
		<a
			class="bg-[#0E111A] rounded-lg flex flex-row items-center p-6 gap-4 lg:p-8 lg:gap-8 focus-visible:scale-105 hover:scale-105 transition-transform shadow"
			href={`https://github.com/oscartbeaumont/${props.name}`}
			target="_blank"
			rel="noopener noreferrer"
		>
			{props.logoHref && (
				<img
					src={props.logoHref}
					alt={props.logoAlt}
					draggable="false"
					class="size-24 lg:size-32 object-contain"
				/>
			)}

			<div class="flex flex-col flex-1 gap-2">
				<h2 class="text-xl lg:text-3xl tracking-tight">{props.name}</h2>
				<p class="text-slate-200 font-semibold text-sm lg:text-base">
					{props.children}
				</p>
			</div>
		</a>
	);
}
