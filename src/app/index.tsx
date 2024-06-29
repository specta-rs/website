import type { ParentProps } from "solid-js";

export function Navbar() {
	return (
		<div class="backdrop-blur-sm w-full h-16 px-4 flex items-center justify-between fixed top-0">
			<h1 class="font-bold text-3xl">specta-rs</h1>

			<div class="flex items-center space-x-4">
				<a href="https://github.com/specta-rs">
					<GitHubLogo />
				</a>
				<a href="https://discord.com/invite/JgqH8b4ycw">
					<DiscordLogo />
				</a>
			</div>
		</div>
	);
}

function GitHubLogo() {
	return (
		<svg width="28" height="28" fill="currentColor" viewBox="3 3 18 18">
			<title>GitHub</title>
			<path d="M12 3C7.0275 3 3 7.12937 3 12.2276C3 16.3109 5.57625 19.7597 9.15374 20.9824C9.60374 21.0631 9.77249 20.7863 9.77249 20.5441C9.77249 20.3249 9.76125 19.5982 9.76125 18.8254C7.5 19.2522 6.915 18.2602 6.735 17.7412C6.63375 17.4759 6.19499 16.6569 5.8125 16.4378C5.4975 16.2647 5.0475 15.838 5.80124 15.8264C6.51 15.8149 7.01625 16.4954 7.18499 16.7723C7.99499 18.1679 9.28875 17.7758 9.80625 17.5335C9.885 16.9337 10.1212 16.53 10.38 16.2993C8.3775 16.0687 6.285 15.2728 6.285 11.7432C6.285 10.7397 6.63375 9.9092 7.20749 9.26326C7.1175 9.03257 6.8025 8.08674 7.2975 6.81794C7.2975 6.81794 8.05125 6.57571 9.77249 7.76377C10.4925 7.55615 11.2575 7.45234 12.0225 7.45234C12.7875 7.45234 13.5525 7.55615 14.2725 7.76377C15.9937 6.56418 16.7475 6.81794 16.7475 6.81794C17.2424 8.08674 16.9275 9.03257 16.8375 9.26326C17.4113 9.9092 17.76 10.7281 17.76 11.7432C17.76 15.2843 15.6563 16.0687 13.6537 16.2993C13.98 16.5877 14.2613 17.1414 14.2613 18.0065C14.2613 19.2407 14.25 20.2326 14.25 20.5441C14.25 20.7863 14.4188 21.0746 14.8688 20.9824C16.6554 20.364 18.2079 19.1866 19.3078 17.6162C20.4077 16.0457 20.9995 14.1611 21 12.2276C21 7.12937 16.9725 3 12 3Z"></path>
		</svg>
	);
}

function DiscordLogo() {
	return (
		<svg
			width="28"
			height="28"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 127.14 96.36"
		>
			<path
				fill="#fff"
				d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
			/>
		</svg>
	);
}

export function Hero() {
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

				{/* TODO: Logo that doesn't break Tauri's guideline */}
				<HeroItem name="tauri-specta" logoAlt="Tauri Specta Logo">
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
