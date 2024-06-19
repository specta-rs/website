import type { ParentProps } from "solid-js";

export function Navbar() {
  return (
    <div class="backdrop-blur-sm w-full h-16 px-4 flex items-center">
      <h1 class="font-bold text-3xl">Specta-rs</h1>
    </div>
  );
}

export function Hero() {
  return (
    <main class="px-4 md:px-12">
      <div class="pt-[20vh] flex flex-col justify-center space-y-4">
        <h1 class="text-6xl md:text-8xl">Specta-rs</h1>
        <h2 class="text-3xl md:text-4xl">
          Rust crates for building better webapps
        </h2>
      </div>

      <div class="flex space-x-4 pt-20">
        <HeroItem name="Specta" logoHref="/logo.png" logoAlt="Specta Logo">
          Export your Rust types to any language!
        </HeroItem>

        <HeroItem name="rspc" logoHref="/rspc-logo.png" logoAlt="rspc Logo">
          A framework for building <br /> typesafe web backends in Rust
        </HeroItem>

        {/* TODO: Logo that doesn't break Tauri's guideline */}
        <HeroItem name="Tauri Specta" logoAlt="Tauri Specta Logo">
          Completely typesafe Tauri <br /> commands
        </HeroItem>
      </div>
    </main>
  );
}

function HeroItem(
  props: ParentProps<{ name: string; logoHref?: string; logoAlt: string }>
) {
  return (
    <div class="bg-[#0E111A]/80 border rounded-lg flex flex-col items-center p-4">
      {props.logoHref ? (
        <img src={props.logoHref} alt={props.logoAlt} class="max-h-48" />
      ) : (
        <div class="h-full max-h-48 bg-white"></div>
      )}

      <h2 class="mt-2 mb-2 text-center text-xl sm:text-3xl tracking-tight">
        {props.name}
      </h2>
      <p class="text-slate-200 font-semibold text-center">{props.children}</p>
    </div>
  );
}
