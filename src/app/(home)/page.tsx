import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Code2,
  Zap,
  Shield,
  Github,
  Discord,
  BookOpen,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { getGitHubStars } from "@/lib/getGitHubStars";
import { DiscordLogo } from "@/components/logos";

export default async function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <HeroSection />
      <WhySpectaRsSection />
      <ProjectsSection />
      <ProductionUsersSection />
      <SponsorsSection />
      <CTASection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24 lg:py-32 flex-1">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/*<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-fd-secondary/50 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-fd-muted-foreground">
            Rust crates for building better web apps
          </span>
        </div>*/}

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
          Build better web apps with{" "}
          <span className="bg-linear-to-r from-[#F74C00] to-[#F49600] bg-clip-text text-transparent">
            Rust
          </span>
        </h1>

        <p className="text-lg md:text-xl text-fd-muted-foreground max-w-2xl mx-auto">
          An ecosystem of crates focused on typesafety, developer experience,
          modern practices which scales to large codebases allowing you to build
          faster and deploy with confidence.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/docs"
            className={cn(
              buttonVariants({ variant: "primary" }),
              "gap-2 px-6 py-3 text-base",
            )}
          >
            Get started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://discord.com/invite/JgqH8b4ycw"
            target="_blank"
            rel="noopener"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "gap-2 px-6 py-3 text-base",
            )}
          >
            <DiscordLogo className="brightness-0 dark:invert w-4 h-4" />
            Join Discord
          </a>
        </div>
      </div>
    </section>
  );
}

function WhySpectaRsSection() {
  return (
    <section className="border-t bg-fd-secondary/20">
      <div className="container mx-auto px-4 py-20 md:py-28 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Why specta-rs?
          </h2>
          <p className="text-center text-fd-muted-foreground mb-16 md:mb-20 text-lg">
            An ecosystem of Rust crates built for
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-[#F74C00]/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-[#F74C00]" />
              </div>
              <h3 className="text-xl font-semibold">Typesafety</h3>
              <p className="text-fd-muted-foreground text-[15px] leading-relaxed">
                Types should always be inferred end-to-end, allowing you to move
                quickly and collaborate while maintaining confidence that your
                code is correct.
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-[#F49600]/10 flex items-center justify-center">
                <Code2 className="w-7 h-7 text-[#F49600]" />
              </div>
              <h3 className="text-xl font-semibold">Developer Experience</h3>
              <p className="text-fd-muted-foreground text-[15px] leading-relaxed">
                Obsessed with simplicity, while maintaining flexibility. We
                build tools that make doing the "right thing" the "easy thing",
                freeing you up to focus on the things that matter.
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-[#CE422B]/10 flex items-center justify-center">
                <Zap className="w-7 h-7 text-[#CE422B]" />
              </div>
              <h3 className="text-xl font-semibold">Modern Practices</h3>
              <p className="text-fd-muted-foreground text-[15px] leading-relaxed">
                Embrace the world of modern JavaScript tooling, enabling you to
                ship better user experiences than server-driven approaches.
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-[#8B4513]/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-[#8B4513]" />
              </div>
              <h3 className="text-xl font-semibold">Scale</h3>
              <p className="text-fd-muted-foreground text-[15px] leading-relaxed">
                Build codebases that scale sanely, both in performance and
                maintainability. Take advantage of Rust's compile-time checks
                and tooling to reduce risk when developing large-scale
                applications.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectsSection() {
  return (
    <section className="border-t">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Projects
          </h2>
          <p className="text-center text-fd-muted-foreground mb-12 text-lg">
            Choose the right tool for your project
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <ProjectCard
              name="Specta"
              repo="specta-rs/specta"
              logo="/assets/specta.svg"
              description="Export your Rust types to any language. The foundation for type-safe communication across your stack."
              docsUrl="/docs/specta"
              docsrsUrl="https://docs.rs/specta"
            />

            <ProjectCard
              name="rspc"
              repo="specta-rs/rspc"
              logo="/assets/rspc.svg"
              description="A blazingly fast and typesafe RPC framework for Rust. Build web APIs with end-to-end type safety."
              docsUrl="/docs/rspc"
            />

            <ProjectCard
              name="Tauri Specta"
              repo="specta-rs/tauri-specta"
              logo="/assets/tauri-specta.png"
              description="Typesafe Tauri commands with Specta. Build desktop apps with full type safety between Rust and TypeScript."
              docsUrl="/docs/tauri-specta"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductionUsersSection() {
  return (
    <section className="border-t bg-fd-secondary/20">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Production Users
          </h2>
          <p className="text-center text-fd-muted-foreground mb-12 text-lg">
            Trusted by teams building ambitious projects
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
            {[
              { name: "Spacedrive", url: "https://spacedrive.com" },
              { name: "CrabNebula Cloud", url: "https://crabnebula.cloud" },
              { name: "Twidge", url: "https://twidge.app" },
              { name: "Reader", url: "https://readhq.com" },
            ].map((user) => (
              <a
                key={user.name}
                href={user.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-fd-muted-foreground hover:text-fd-foreground transition-colors"
              >
                {user.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SponsorsSection() {
  return (
    <section className="border-t">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Sponsors
          </h2>
          <p className="text-center text-fd-muted-foreground mb-12 text-lg">
            Supported by amazing organizations
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            {[
              {
                name: "CrabNebula",
                logo: "https://avatars.githubusercontent.com/u/103866414?s=200&v=4",
                url: "https://crabnebula.dev",
                tier: "gold",
              },
              {
                name: "Spacedrive",
                logo: "https://avatars.githubusercontent.com/u/103801871?s=200&v=4",
                url: "https://spacedrive.com",
                tier: "silver",
              },
            ].map((sponsor) => (
              <a
                key={sponsor.name}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-4 rounded-lg border border-fd-border hover:border-fd-foreground/30 bg-fd-card hover:shadow-lg transition-all"
              >
                {/*<Image
                  src={sponsor.logo}
                  alt={sponsor.name}
                  width={48}
                  height={48}
                  className="rounded"
                />*/}
                <span className="font-semibold">{sponsor.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="border-t bg-linear-to-br from-[#F74C00]/10 to-[#F49600]/10">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to build better web apps?
          </h2>
          <p className="text-lg text-fd-muted-foreground">
            Join the community and start building with specta-rs today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/docs"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "gap-2 px-6 py-3 text-base",
              )}
            >
              Documentation
              <BookOpen className="w-4 h-4" />
            </Link>
            <a
              href="https://discord.com/invite/JgqH8b4ycw"
              target="_blank"
              rel="noopener"
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
  );
}

function ProjectCard(props: {
  name: string;
  repo?: string;
  logo: string;
  description: string;
  docsUrl?: string;
  docsrsUrl?: string;
}) {
  return (
    <div className="border rounded-lg p-6 bg-fd-card hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 relative">
          <Image
            src={props.logo}
            alt={`${props.name} logo`}
            fill
            className="object-contain"
          />
        </div>
        <div>
          <h3 className="text-xl font-bold">{props.name}</h3>

          {props.repo ? <Stars stars={getGitHubStars(props.repo)} /> : null}
        </div>
      </div>
      <p className="text-fd-muted-foreground mb-6">{props.description}</p>
      <div className="flex gap-2">
        {props.docsUrl && (
          <Link
            href={props.docsUrl}
            className={cn(
              buttonVariants({ variant: "primary", size: "sm" }),
              "flex-1",
            )}
          >
            <BookOpen className="w-4 h-4 mr-1" />
            Docs
          </Link>
        )}
        <a
          href={`https://github.com/${props.repo}`}
          target="_blank"
          rel="noopener"
          className={cn(
            buttonVariants({
              variant: "outline",
              size: "sm",
            }),
            props.docsUrl ? "" : "flex-1",
          )}
        >
          <Github className="w-4 h-4 mr-1" />
          GitHub
        </a>
        {props.docsrsUrl && (
          <a
            href={props.docsrsUrl}
            target="_blank"
            rel="noopener"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function Stars(props: { stars: Promise<string> }) {
  return (
    <Suspense>
      <div className="flex items-center gap-2 text-sm text-fd-muted-foreground animate-in fade-in">
        <span>★ {props.stars}</span>
      </div>
    </Suspense>
  );
}
