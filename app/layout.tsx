import { RootProvider } from "fumadocs-ui/provider";
import { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./global.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://specta.dev"),
  title: "specta-rs",
  description: "Rust crates for building better web apps",
  authors: [
    {
      name: "Oscar Beaumont",
      url: "https://otbeaumont.me",
    },
  ],
  alternates: { canonical: "https://specta.dev" },
  icons: [
    {
      type: "image/x-icon",
      url: "/favicon.png",
    },
  ],
  openGraph: {
    type: "website",
    title: "specta-rs",
    description: "Rust crates for building better web apps",
    url: "https://specta.dev",
    locale: "en_US",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={"h-full w-full " + inter.className}
      suppressHydrationWarning
    >
      <body className="h-full w-full overscroll-y-none">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
