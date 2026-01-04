import Link from "next/link";
import Image from "next/image";
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
import { Suspense } from "react";
import { getGitHubStars } from "@/lib/getGitHubStars";
import { DiscordLogo } from "@/components/logos";

export default async function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <Features />
      <Projects />
      <CTASection />
    </div>
  );
}

function Hero() {
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
              "gap-2 px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0s_both]",
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
              "gap-2 px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0.2s_both]",
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

function Features() {
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
            <div className="space-y-4 motion-safe:animate-[fadeIn_0.3s_0s_both]">
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

            <div className="space-y-4 motion-safe:animate-[fadeIn_0.3s_0.2s_both]">
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

            <div className="space-y-4 motion-safe:animate-[fadeIn_0.3s_0.4s_both]">
              <div className="w-14 h-14 rounded-xl bg-[#CE422B]/10 flex items-center justify-center">
                <Zap className="w-7 h-7 text-[#CE422B]" />
              </div>
              <h3 className="text-xl font-semibold">Modern Practices</h3>
              <p className="text-fd-muted-foreground text-[15px] leading-relaxed">
                Embrace the world of modern JavaScript tooling, enabling you to
                ship better user experiences than server-driven approaches.
              </p>
            </div>

            <div className="space-y-4 motion-safe:animate-[fadeIn_0.3s_0.6s_both]">
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

function Projects() {
  return (
    <section className="border-t bg-fd-secondary/10">
      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Our Projects
            </h2>
            <p className="text-fd-muted-foreground text-lg max-w-2xl mx-auto">
              A collection of powerful, type-safe tools designed to work
              seamlessly together
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <ProjectCard
              name="Specta"
              repo="specta-rs/specta"
              logo="/assets/specta.svg"
              description="Export your Rust types to any language. The foundation for type-safe communication across your stack."
              docsUrl="/docs/specta"
              gradient="from-[#F74C00] via-[#CC3A00]/60 to-[#F49600]/40"
              accentColor="border-[#F74C00]/20"
              className="motion-safe:animate-[fadeIn_0.3s_0s_both]"
            />

            <ProjectCard
              name="rspc"
              repo="specta-rs/rspc"
              logo="/assets/rspc.svg"
              description="A blazingly fast and typesafe RPC framework for Rust. Build web APIs with end-to-end type safety."
              docsUrl="/docs/rspc"
              gradient="from-[#0092DE] via-[#0092DE]/60 to-[#00A4FA]/40"
              accentColor="border-[#0092DE]/20"
              className="motion-safe:animate-[fadeIn_0.3s_0.2s_both]"
            />

            <ProjectCard
              name="Tauri Specta"
              repo="specta-rs/tauri-specta"
              logo="/assets/tauri-specta.png"
              description="Typesafe Tauri commands with Specta. Build desktop apps with full type safety between Rust and TypeScript."
              docsUrl="/docs/tauri-specta"
              gradient="from-[#FFC131] via-[#FFC131]/60 to-[#FFC947]/40"
              accentColor="border-[#FFC131]/20"
              className="motion-safe:animate-[fadeIn_0.3s_0.4s_both]"
            />
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
                "gap-2 px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0s_both]",
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
                "gap-2 px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0.2s_both] bg-fd-background",
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
  gradient?: string;
  accentColor?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative border rounded-2xl p-8 bg-fd-card hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden",
        props.accentColor
          ? `hover:${props.accentColor}`
          : "hover:border-fd-primary/20",
        props.className,
      )}
    >
      {/* Gradient accent on hover */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-300 bg-gradient-to-br",
          props.gradient || "from-[#F74C00] to-[#F49600]",
        )}
      />

      <div className="relative z-10 flex flex-col h-full">
        {props.repo ? (
          <div className="absolute top-0 right-0">
            <Stars stars={getGitHubStars(props.repo)} />
          </div>
        ) : null}

        {/* Logo and title section */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 relative shrink-0 rounded-xl bg-fd-secondary/50 p-2.5 group-hover:scale-110 transition-transform duration-300">
            <Image
              src={props.logo}
              alt={`${props.name} logo`}
              fill
              className="object-contain h-14"
            />
          </div>
          <div className="flex-1 min-w-0 pr-20">
            <h3 className="text-2xl font-bold mb-2 group-hover:text-fd-primary transition-colors">
              {props.name}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-fd-muted-foreground leading-relaxed mb-8 grow">
          {props.description}
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 mt-auto">
          {props.docsUrl && (
            <Link
              href={props.docsUrl}
              className={cn(
                buttonVariants({ variant: "primary" }),
                "flex-1 group/btn px-4 py-2",
              )}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Documentation
            </Link>
          )}
          {props.repo && (
            <a
              href={`https://github.com/${props.repo}`}
              target="_blank"
              rel="noopener"
              className={cn(
                buttonVariants({
                  variant: "outline",
                }),
                !props.docsUrl ? "flex-1 px-4 py-2" : "px-4 py-2",
              )}
            >
              <Github className="w-4 h-4 mr-2" />
              GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Stars(props: { stars: Promise<string> }) {
  return (
    <Suspense
      fallback={
        <div className="h-6 w-24 animate-pulse bg-fd-secondary/50 rounded-full" />
      }
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fd-secondary/50 border border-fd-border text-sm text-fd-muted-foreground animate-in fade-in backdrop-blur-sm">
        <span className="text-yellow-500">★</span>
        <span className="font-medium">{props.stars}</span>
      </div>
    </Suspense>
  );
}
