import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Zap,
  Shield,
  Github,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 lg:py-32 flex-1">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-fd-secondary/50 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-fd-muted-foreground">
              Rust crates for building better web apps
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            Export your Rust types to{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              any language
            </span>
          </h1>

          <p className="text-lg md:text-xl text-fd-muted-foreground max-w-2xl mx-auto">
            Build typesafe web backends and desktop apps with Rust. Specta
            automatically generates TypeScript types from your Rust code,
            ensuring end-to-end type safety.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/docs"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "gap-2 px-6 py-3 text-base",
              )}
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/specta-rs"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "gap-2 px-6 py-3 text-base",
              )}
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Why Specta Section */}
      <section className="border-t bg-fd-secondary/20">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Why use Specta?
            </h2>
            <p className="text-center text-fd-muted-foreground mb-12 text-lg">
              Build faster and safer with compile-time guarantees
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold">Type Safety</h3>
                <p className="text-fd-muted-foreground">
                  Catch bugs at compile time instead of runtime. Your frontend
                  and backend stay in perfect sync automatically.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-cyan-500" />
                </div>
                <h3 className="text-xl font-semibold">Zero Overhead</h3>
                <p className="text-fd-muted-foreground">
                  Types are generated at build time with no runtime cost. Get
                  full IntelliSense and autocomplete in your editor.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Code2 className="w-6 h-6 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold">Developer Experience</h3>
                <p className="text-fd-muted-foreground">
                  Simple macros and intuitive APIs. Integrates seamlessly with
                  existing Rust and TypeScript projects.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Libraries Section */}
      <section className="border-t">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Specta-based Libraries
            </h2>
            <p className="text-center text-fd-muted-foreground mb-12 text-lg">
              Choose the right tool for your project
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Specta Card */}
              <div className="border rounded-lg p-6 bg-fd-card hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                    S
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">specta</h3>
                    <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                      <span>★ 503</span>
                    </div>
                  </div>
                </div>
                <p className="text-fd-muted-foreground mb-6">
                  The core library for exporting Rust types. Use this if you
                  want to integrate type exports into your own projects.
                </p>
                <div className="flex gap-2">
                  <a
                    href="https://github.com/specta-rs/specta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "flex-1",
                    )}
                  >
                    <Github className="w-4 h-4 mr-1" />
                    GitHub
                  </a>
                  <a
                    href="https://docs.rs/specta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                    )}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* rspc Card */}
              <div className="border rounded-lg p-6 bg-fd-card hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">
                    R
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">rspc</h3>
                    <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                      <span>★ 1,346</span>
                    </div>
                  </div>
                </div>
                <p className="text-fd-muted-foreground mb-6">
                  A tRPC-inspired framework for building typesafe web backends
                  in Rust. Perfect for web APIs and full-stack applications.
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/docs/rspc"
                    className={cn(
                      buttonVariants({ variant: "primary", size: "sm" }),
                      "flex-1",
                    )}
                  >
                    <BookOpen className="w-4 h-4 mr-1" />
                    Docs
                  </Link>
                  <a
                    href="https://github.com/specta-rs/rspc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <Github className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Tauri Specta Card */}
              <div className="border rounded-lg p-6 bg-fd-card hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    T
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">tauri-specta</h3>
                    <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                      <span>★ 626</span>
                    </div>
                  </div>
                </div>
                <p className="text-fd-muted-foreground mb-6">
                  Completely typesafe Tauri commands and events. Build desktop
                  apps with full type safety between Rust and TypeScript.
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/docs/tauri-specta"
                    className={cn(
                      buttonVariants({ variant: "primary", size: "sm" }),
                      "flex-1",
                    )}
                  >
                    <BookOpen className="w-4 h-4 mr-1" />
                    Docs
                  </Link>
                  <a
                    href="https://github.com/specta-rs/tauri-specta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <Github className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to build typesafe apps?
            </h2>
            <p className="text-lg text-fd-muted-foreground">
              Join the community and start building with Specta today
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/docs"
                className={cn(
                  buttonVariants({ variant: "primary" }),
                  "gap-2 px-6 py-3 text-base",
                )}
              >
                Read the Documentation
                <BookOpen className="w-4 h-4" />
              </Link>
              <a
                href="https://discord.com/invite/JgqH8b4ycw"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "gap-2 px-6 py-3 text-base",
                )}
              >
                Join Discord
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
