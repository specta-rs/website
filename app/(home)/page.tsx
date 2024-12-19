import Link from "next/link";
import Image from "next/image";
import { PropsWithChildren } from "react";

import spectaLogo from "../../public/images/logo.png";
import rspcLogo from "../../public/images/rspc-logo.png";
import tauriSpectaLogo from "../../public/images/tauri-specta-logo.png";
import Script from "next/script";

export const revalidate = 3600;

export default function HomePage() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <main className="px-4 lg:px-12 grid grid-flow-row lg:grid-flow-col justify-center items-center h-full gap-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-6xl lg:text-8xl hidden sm:block">specta-rs</h1>
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
            starButtonFor="specta-rs/specta"
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
            starButtonFor="specta-rs/rspc"
          >
            A framework for building typesafe web backends in Rust
          </HeroItem>

          <HeroItem
            name="tauri-specta"
            logoHref={tauriSpectaLogo.src}
            logoAlt="Tauri Specta Logo"
            githubHref="https://github.com/specta-rs/tauri-specta"
            documentationHref="/docs/tauri-specta"
            packageManagerHref="https://crates.io/crates/tauri-specta"
            starButtonFor="specta-rs/tauri-specta"
          >
            Completely typesafe Tauri commands and events
          </HeroItem>
        </div>
      </main>
    </div>
  );
}

async function HeroItem(
  props: PropsWithChildren<{
    name: string;
    logoHref?: string;
    logoAlt: string;
    githubHref?: string;
    documentation?: string;
    documentationHref?: string;
    packageManager?: string;
    packageManagerHref?: string;
    starButtonFor: string;
  }>,
) {
  const resp = await fetch(
    `https://api.github.com/repos/${props.starButtonFor}`,
  );
  const stars = resp.ok ? (await resp.json()).stargazers_count : 0;

  return (
    <div className="bg-neutral-50 dark:bg-[#171717] rounded-lg flex flex-row items-center py-6 px-3 md:px-6 gap-4 md:gap-8 lg:p-8 focus-visible:scale-105 shadow">
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
        <div className="flex justify-between">
          <h2 className="text-xl lg:text-3xl tracking-tight">{props.name}</h2>
          <div>
            {props.githubHref && (
              <GitHubStarButton href={props.githubHref} stars={stars} />
            )}
          </div>
        </div>
        <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm lg:text-base">
          {props.children}
        </p>

        <div className="flex space-x-3 md:space-x-3 justify-between md:justify-start">
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

function GitHubStarButton(props: { href: string; stars: number }) {
  // TODO: It would be nice to show this on mobile too. Right now it's hidden.
  return (
    <a
      className="rounded-sm px-2 py-0.5 flex flex-row items-center bg-neutral-200 border-2 border-neutral-300 text-black dark:bg-neutral-800 dark:text-white dark:border-neutral-700 max-[500px]:hidden"
      href={props.href}
    >
      <svg
        aria-hidden="true"
        height="16"
        viewBox="0 0 16 16"
        version="1.1"
        width="16"
        fill="currentColor"
        data-view-component="true"
        className="octicon octicon-star d-inline-block mr-1"
      >
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"></path>
      </svg>

      <span className="">{props.stars.toLocaleString()}</span>
    </a>
  );
}
