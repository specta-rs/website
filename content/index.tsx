import {
  ArrowRight,
  BookOpen,
  Code2,
  ExternalLink,
  Heart,
  Shield,
  Zap,
} from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { DiscordLogo, GitHubLogo } from "@/components/logos";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import siteData from "../theme/site-data.json";

export const frontmatter = {
  pageType: "custom",
};

const stars = siteData.stars as Record<string, string>;
const sponsors = siteData.sponsors;

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Hero />
      <Features />
      <Projects />
      <Support />
      <CTASection />
    </div>
  );
}

function Hero() {
  return (
    <section className="container mx-auto flex-1 px-4 py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-4xl space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Build better web apps with{" "}
          <span className="bg-linear-to-r from-[#F74C00] to-[#F49600] bg-clip-text text-transparent">
            Rust
          </span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-fd-muted-foreground md:text-xl">
          An ecosystem of crates focused on typesafety, developer experience,
          modern practices which scales to large codebases allowing you to build
          faster and deploy with confidence.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/docs"
            className={cn(
              buttonVariants({ variant: "primary", size: "sm" }),
              "gap-2 px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0s_both]",
            )}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="https://discord.com/invite/JgqH8b4ycw"
            target="_blank"
            rel="noopener"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "gap-2 px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0.2s_both]",
            )}
          >
            <DiscordLogo className="h-4 w-4 brightness-0 dark:invert" />
            Join Discord
          </a>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Shield,
    color: "#F74C00",
    title: "Typesafety",
    body: "Types should always be inferred end-to-end, allowing you to move quickly and collaborate while maintaining confidence that your code is correct.",
  },
  {
    icon: Code2,
    color: "#F49600",
    title: "Developer Experience",
    body: 'Obsessed with simplicity, while maintaining flexibility. We build tools that make doing the "right thing" the "easy thing", freeing you up to focus on the things that matter.',
  },
  {
    icon: Zap,
    color: "#CE422B",
    title: "Modern Practices",
    body: "Embrace the world of modern JavaScript tooling, enabling you to ship better user experiences than server-driven approaches.",
  },
  {
    icon: Shield,
    color: "#8B4513",
    title: "Scale",
    body: "Build codebases that scale sanely, both in performance and maintainability. Take advantage of Rust's compile-time checks and tooling to reduce risk when developing large-scale applications.",
  },
];

function Features() {
  return (
    <section className="border-t bg-fd-secondary/20">
      <div className="container mx-auto px-4 py-20 md:py-28 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Why specta-rs?
          </h2>
          <p className="mb-16 text-center text-lg text-fd-muted-foreground md:mb-20">
            An ecosystem of Rust crates built for
          </p>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="space-y-4 motion-safe:animate-[fadeIn_0.3s_both]"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${feature.color}1a` }}
                  >
                    <Icon
                      className="h-7 w-7"
                      style={{ color: feature.color }}
                    />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-[15px] leading-relaxed text-fd-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const projects = [
  {
    name: "Specta",
    repo: "specta-rs/specta",
    description:
      "Export your Rust types to any language. The foundation for type-safe communication across your stack.",
    docsUrl: "/docs/specta",
    logo: (
      <div className="relative h-14 w-14 shrink-0 rounded-xl bg-fd-secondary/50 p-2.5 transition-transform duration-300 group-hover:scale-110">
        <img
          src="/assets/specta.svg"
          alt="Specta logo"
          className="object-contain"
        />
      </div>
    ),
    gradient: "from-[#F74C00] via-[#CC3A00]/60 to-[#F49600]/40",
    hoverClass: "hover:border-[#F74C00]/20",
  },
  {
    name: "rspc",
    repo: "specta-rs/rspc",
    description:
      "A blazingly fast and typesafe RPC framework for Rust. Build web APIs with end-to-end type safety.",
    docsUrl: "/docs/rspc",
    logo: (
      <div className="relative h-14 w-14 shrink-0 rounded-xl bg-fd-secondary/50 p-2.5 transition-transform duration-300 group-hover:scale-110">
        <img
          src="/assets/rspc.svg"
          alt="rspc logo"
          className="object-contain"
        />
      </div>
    ),
    gradient: "from-[#0092DE] via-[#0092DE]/60 to-[#00A4FA]/40",
    hoverClass: "hover:border-[#0092DE]/20",
  },
  {
    name: "Tauri Specta",
    repo: "specta-rs/tauri-specta",
    description:
      "Typesafe Tauri commands with Specta. Build desktop apps with full type safety between Rust and TypeScript.",
    docsUrl: "/docs/tauri-specta",
    logo: (
      <div className="relative h-10 w-22 shrink-0 self-center rounded-xl bg-fd-secondary/50 p-2.5 transition-transform duration-300 group-hover:scale-110">
        <img
          src="/assets/tauri-specta.png"
          alt="Tauri Specta logo"
          className="object-contain"
        />
      </div>
    ),
    gradient: "from-[#FFC131] via-[#FFC131]/60 to-[#FFC947]/40",
    hoverClass: "hover:border-[#FFC131]/20",
  },
];

function Projects() {
  return (
    <section className="border-t bg-fd-secondary/10">
      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Our Projects
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-fd-muted-foreground">
              A collection of powerful, type-safe tools designed to work
              seamlessly together
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.name}
                {...project}
                className="motion-safe:animate-[fadeIn_0.3s_both]"
                style={{ animationDelay: `${index * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectCard(props: {
  name: string;
  repo?: string;
  logo: JSX.Element;
  description: string;
  docsUrl?: string;
  gradient?: string;
  hoverClass: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-fd-card p-8 transition-all duration-300 hover:shadow-2xl",
        props.hoverClass,
        props.className,
      )}
      style={props.style}
    >
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-[0.08]",
          props.gradient || "from-[#F74C00] to-[#F49600]",
        )}
      />

      <div className="relative z-10 flex h-full flex-col">
        {props.repo ? (
          <div className="absolute top-0 right-0">
            <div className="flex items-center gap-1.5 rounded-full border border-fd-border bg-fd-secondary/50 px-3 py-1.5 text-sm text-fd-muted-foreground backdrop-blur-sm">
              <span className="text-yellow-500">★</span>
              <span className="font-medium">{stars[props.repo] ?? "-"}</span>
            </div>
          </div>
        ) : null}

        <div className="mb-6 flex items-start gap-4">
          {props.logo}

          <div className="min-w-0 flex-1 pr-20">
            <h3 className="mb-2 text-2xl font-bold transition-colors group-hover:text-fd-primary">
              {props.name}
            </h3>
          </div>
        </div>

        <p className="mb-8 grow leading-relaxed text-fd-muted-foreground">
          {props.description}
        </p>

        <div className="mt-auto flex gap-3">
          {props.docsUrl && (
            <a
              href={props.docsUrl}
              className={cn(
                buttonVariants({ variant: "primary" }),
                "group/btn flex-1 px-4 py-2",
              )}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Documentation
            </a>
          )}
          {props.repo && (
            <a
              href={`https://github.com/${props.repo}`}
              target="_blank"
              rel="noopener"
              className={cn(
                buttonVariants({ variant: "outline" }),
                !props.docsUrl ? "flex-1 px-4 py-2" : "px-4 py-2",
              )}
            >
              <GitHubLogo className="mr-2 h-4 w-4" />
              GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Support() {
  const direct = sponsors.filter((sponsor) => sponsor.tier === "direct");
  const github = sponsors.filter((sponsor) => sponsor.tier === "github");

  return (
    <section className="border-t bg-fd-secondary/10">
      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Support development
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-fd-muted-foreground">
              specta-rs is built and maintained by Oscar Beaumont. Sponsorships
              fund the time that goes into it.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {direct.map((sponsor) => (
              <SponsorCard key={sponsor.name} sponsor={sponsor} featured />
            ))}
          </div>

          {github.length > 0 ? (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-fd-muted-foreground">
                With thanks to
              </span>
              {github.map((sponsor) => (
                <SponsorCard key={sponsor.name} sponsor={sponsor} />
              ))}
            </div>
          ) : null}

          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/sponsors/oscartbeaumont"
              target="_blank"
              rel="noopener"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "gap-2 px-6 py-3 text-base",
              )}
            >
              <Heart className="h-4 w-4" />
              Become a sponsor
            </a>
            <span className="text-sm text-fd-muted-foreground">
              or support through{" "}
              <a
                href="https://paypal.me/oscartbeaumont"
                target="_blank"
                rel="noopener"
                className="underline underline-offset-2 hover:text-fd-foreground"
              >
                PayPal
              </a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SponsorCard({
  sponsor,
  featured = false,
}: {
  sponsor: { name: string; url: string; logo: string };
  featured?: boolean;
}) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-fd-card transition-colors hover:border-fd-primary/30",
        featured ? "px-5 py-4" : "px-3 py-2",
      )}
    >
      <img
        src={sponsor.logo}
        alt={`${sponsor.name} logo`}
        loading="lazy"
        className={cn(
          "rounded-lg object-contain",
          featured ? "size-12" : "size-7",
        )}
      />
      <span className={cn("font-semibold", featured ? "text-lg" : "text-sm")}>
        {sponsor.name}
      </span>
    </a>
  );
}

function CTASection() {
  return (
    <section className="border-t bg-linear-to-br from-[#F74C00]/10 to-[#F49600]/10">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Ready to build better web apps?
          </h2>
          <p className="text-lg text-fd-muted-foreground">
            Join the community and start building with specta-rs today
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/docs"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "gap-2 px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0s_both]",
              )}
            >
              Documentation
              <BookOpen className="h-4 w-4" />
            </a>
            <a
              href="https://discord.com/invite/JgqH8b4ycw"
              target="_blank"
              rel="noopener"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "gap-2 bg-fd-background px-6 py-3 text-base motion-safe:animate-[fadeIn_0.3s_0.2s_both]",
              )}
            >
              Join Discord
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
