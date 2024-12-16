import Link from "next/link";
import Image from "next/image";
import { PropsWithChildren } from "react";

import spectaLogo from "../../public/images/logo.png";
import rspcLogo from "../../public/images/rspc-logo.png";
import tauriSpectaLogo from "../../public/images/tauri-specta-logo.png";

export default function HomePage() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <main className="px-4 lg:px-12 flex flex-col lg:flex-row justify-center items-center h-full gap-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-6xl lg:text-8xl">specta-rs</h1>
          <h2 className="text-3xl lg:text-4xl">
            Rust crates for building better web apps
          </h2>
          <div className="flex space-x-4">
            <Link href="/docs" className="hover:underline">
              Documentation
            </Link>
            <a href="https://github.com/specta-rs" className="hover:underline">
              GitHub
            </a>
            <a
              href="https://discord.com/invite/JgqH8b4ycw"
              className="hover:underline"
            >
              Discord
            </a>
          </div>
        </div>

        <div className="flex gap-4 flex-col">
          <HeroItem
            name="specta"
            logoHref={spectaLogo.src}
            logoAlt="Specta Logo"
            githubHref="https://github.com/specta-rs/specta"
            documentation="docs.io"
            documentationHref="https://docs.rs/specta"
            packageManagerHref="https://crates.io/crates/specta"
          >
            Export your Rust types to any language!
          </HeroItem>

          <HeroItem
            name="rspc"
            logoHref={rspcLogo.src}
            logoAlt="rspc Logo"
            githubHref="https://github.com/specta-rs/rspc"
            documentationHref="/docs/rspc"
            packageManagerHref="https://crates.io/crates/rspc"
          >
            A framework for building typesafe web backends in Rust
          </HeroItem>

          <HeroItem
            name="tauri-specta"
            logoHref={tauriSpectaLogo.src}
            logoAlt="Tauri Specta Logo"
            githubHref="https://github.com/specta-rs/tauri-specta"
            // packageManagerHref="https://docs.rs/tauri-specta"
            documentationHref="/docs/tauri-specta"
            packageManagerHref="https://crates.io/crates/rspc"
          >
            Completely typesafe Tauri commands and events
          </HeroItem>
        </div>
      </main>
    </div>
  );
}

function HeroItem(
  props: PropsWithChildren<{
    name: string;
    logoHref?: string;
    logoAlt: string;
    githubHref?: string;
    documentation?: string;
    documentationHref?: string;
    packageManager?: string;
    packageManagerHref?: string;
  }>,
) {
  return (
    <div className="bg-[#171717] rounded-lg flex flex-row items-center p-6 gap-4 lg:p-8 lg:gap-8 focus-visible:scale-105 shadow">
      {props.logoHref && (
        <Image
          src={props.logoHref}
          alt={props.logoAlt}
          draggable="false"
          height={64}
          width={64}
          className="size-24 lg:size-32 object-contain"
        />
      )}

      <div className="flex flex-col flex-1 gap-2">
        <h2 className="text-xl lg:text-3xl tracking-tight">{props.name}</h2>
        <p className="text-slate-200 font-semibold text-sm lg:text-base">
          {props.children}
        </p>

        <div className="flex space-x-3">
          {props.githubHref ? (
            <a href={props.githubHref} className="hover:underline">
              GitHub
            </a>
          ) : null}

          {props.documentationHref ? (
            <Link href={props.documentationHref} className="hover:underline">
              {props.documentation || "Documentation"}
            </Link>
          ) : null}

          {props.packageManagerHref ? (
            <a href={props.packageManagerHref} className="hover:underline">
              {props.packageManager || "crates.io"}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
