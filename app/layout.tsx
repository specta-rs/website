import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "...",
  description: "...",
};
// TODO: Finish this

/* <meta charset="utf-8" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<meta name="viewport" content="width=device-width" />
<meta name="generator" content={Astro.generator} />
<title>specta-rs</title>
<meta property="description" content="Rust crates for building better web apps" />
<meta name="author" content="Oscar Beaumont" />
<link rel="canonical" href={Astro.site!.origin} />

<meta property="og:title" content="specta-rs" />
<meta property="og:description" content="Rust crates for building better web apps" />
<meta property="og:url" content={Astro.site!.origin} />
<meta property="og:image" content={`${Astro.site!.origin}/opengraph.png`} />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1600" />
<meta property="og:image:height" content="800" />

<link rel="sitemap" href="/sitemap-index.xml" /> */

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={"h-full w-full " + inter.className}
      suppressHydrationWarning
    >
      {/* class="h-full w-full text-white pt-16 overflow-y-hidden" // TODO */}
      {/* <body className="flex flex-col min-h-screen">
      </body> */}
      <body className="h-full w-full overflow-y-hidden">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
