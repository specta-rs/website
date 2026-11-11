import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Code2,
  ExternalLink,
  Heart,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import { DiscordLogo, GitHubLogo } from "@/components/logos";
import { cn } from "@/lib/utils";
import siteData from "../theme/site-data.json";
import { gurafiAppIcon } from "../theme/gurafi-icon";

export const frontmatter = {
  pageType: "custom",
};

const stars = siteData.stars as Record<string, string>;
const sponsors = siteData.sponsors;

/**
 * Star counts arrive from three sources: the GitHub API (`2,861`), ungh.cc
 * (the same), and shields.io, which abbreviates (`2.8k`). A failed lookup
 * leaves `-` behind. Parse all of them, and treat anything unparseable as zero
 * so the headline total can never become `NaN`.
 */
function starCount(value: unknown): number {
  if (typeof value !== "string") return 0;

  const match = value
    .trim()
    .replaceAll(",", "")
    .match(/^(\d+(?:\.\d+)?)([km])?$/i);
  if (!match) return 0;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;

  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

const totalStars = Object.values(stars)
  .reduce((total, value) => total + starCount(value), 0)
  .toLocaleString("en-US");

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-sp-cta px-5 py-2.5 text-[13px] font-semibold text-sp-cta-foreground shadow-[0_10px_30px_-12px_var(--sp-accent-glow)] transition-colors hover:bg-sp-cta-hover";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-sp-line bg-sp-panel/70 px-5 py-2.5 text-[13px] font-semibold text-fd-foreground transition-colors hover:border-sp-accent-line hover:bg-sp-accent-soft";

export default function HomePage() {
  return (
    <div className="sp-home flex flex-col">
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
    <section className="sp-hero">
      <div className="sp-hero__content mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-14 md:py-20 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14 lg:py-24">
        <div className="max-w-[620px]">
          <p className="sp-eyebrow">Open-source Rust ecosystem</p>

          <h1 className="sp-hero__title mt-5">
            Build better web apps with{" "}
            <span className="sp-hero__rust">Rust</span>
          </h1>

          <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-fd-muted-foreground sm:text-[17px]">
            An ecosystem of crates focused on typesafety, developer experience,
            modern practices which scales to large codebases allowing you to
            build faster and deploy with confidence.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="/docs" className={cn(primaryButton, "px-6 py-3 text-sm")}>
              Get started
              <ArrowRight className="size-4" />
            </a>
            <a
              href="https://discord.com/invite/JgqH8b4ycw"
              target="_blank"
              rel="noopener"
              className={cn(secondaryButton, "px-6 py-3 text-sm")}
            >
              <DiscordLogo className="h-4 w-4 brightness-0 dark:invert" />
              Join Discord
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
            <div className="sp-hero__stat">
              <strong>{totalStars}</strong>
              <span>GitHub stars</span>
            </div>
            <div className="sp-hero__stat">
              <strong>{projects.length}</strong>
              <span>open-source projects</span>
            </div>
          </div>
        </div>

        <TypeBridge />
      </div>
    </section>
  );
}

/**
 * A small, honest demonstration of the product: the example is the one from
 * the Specta getting-started guide, with its generated TypeScript output.
 */
function TypeBridge() {
  return (
    <figure className="sp-code-frame min-w-0">
      <div className="sp-code-panel">
        <div className="sp-code-panel__bar">
          <span className="sp-code-panel__dot" />
          <span className="sp-code-panel__dot" />
          <span className="sp-code-panel__dot" />
          <span className="sp-code-panel__file ml-2 flex-1">src/main.rs</span>
          <span className="sp-code-panel__badge">Specta</span>
        </div>

        <pre className="sp-code">
          <code>
            <span className="tok-punc">#[</span>
            <span className="tok-key">derive</span>
            <span className="tok-punc">(</span>
            <span className="tok-type">Type</span>
            <span className="tok-punc">)]</span>
            {"\n"}
            <span className="tok-key">pub struct</span>{" "}
            <span className="tok-fn">User</span>{" "}
            <span className="tok-punc">{"{"}</span>
            {"\n  "}
            <span className="tok-key">pub</span> id
            <span className="tok-punc">:</span>{" "}
            <span className="tok-type">u32</span>
            <span className="tok-punc">,</span>
            {"\n  "}
            <span className="tok-key">pub</span> name
            <span className="tok-punc">:</span>{" "}
            <span className="tok-type">String</span>
            <span className="tok-punc">,</span>
            {"\n"}
            <span className="tok-punc">{"}"}</span>
          </code>
        </pre>

        <div className="sp-code__divider">generated bindings.ts</div>

        <pre className="sp-code">
          <code>
            <span className="tok-key">export type</span>{" "}
            <span className="tok-fn">User</span>{" "}
            <span className="tok-punc">= {"{"}</span>
            {"\n  "}id
            <span className="tok-punc">:</span>{" "}
            <span className="tok-type">number</span>
            <span className="tok-punc">;</span>
            {"\n  "}name
            <span className="tok-punc">:</span>{" "}
            <span className="tok-type">string</span>
            <span className="tok-punc">;</span>
            {"\n"}
            <span className="tok-punc">{"}"};</span>
          </code>
        </pre>

        <div className="sp-code-panel__foot">
          <span className="sp-code-panel__chip">TypeScript</span>
          <span className="sp-code-panel__chip">Swift</span>
          <span className="sp-code-panel__chip">Go</span>
          <span className="sp-code-panel__chip">JSDoc</span>
          <span className="sp-code-panel__chip">OpenAPI</span>
        </div>
      </div>
      <figcaption className="sr-only">
        A Rust User struct deriving Specta's Type trait, and the equivalent
        generated TypeScript type.
      </figcaption>
    </figure>
  );
}

const features = [
  {
    icon: Shield,
    title: "Typesafety",
    body: "Types should always be inferred end-to-end, allowing you to move quickly and collaborate while maintaining confidence that your code is correct.",
  },
  {
    icon: Code2,
    title: "Developer Experience",
    body: 'Obsessed with simplicity, while maintaining flexibility. We build tools that make doing the "right thing" the "easy thing", freeing you up to focus on the things that matter.',
  },
  {
    icon: Zap,
    title: "Modern Practices",
    body: "Embrace the world of modern JavaScript tooling, enabling you to ship better user experiences than server-driven approaches.",
  },
  {
    icon: Boxes,
    title: "Scale",
    body: "Build codebases that scale sanely, both in performance and maintainability. Take advantage of Rust's compile-time checks and tooling to reduce risk when developing large-scale applications.",
  },
];

function Features() {
  return (
    <section className="sp-section sp-section--soft">
      <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28">
        <SectionIntro
          index="01"
          label="Philosophy"
          title="Why specta-rs?"
          description="An ecosystem of Rust crates built for typesafety, developer experience and scale."
        />

        <div className="sp-cells sm:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="sp-cell p-7 sm:p-8 lg:p-9"
              >
                <div className="mb-7 flex items-start justify-between">
                  <span className="sp-icon-tile">
                    <Icon className="size-5" strokeWidth={1.7} />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.12em] text-fd-muted-foreground/60">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-[20px] font-semibold tracking-[-0.02em]">
                  {feature.title}
                </h3>
                <p className="mt-2.5 max-w-[42ch] text-[14.5px] leading-relaxed text-fd-muted-foreground">
                  {feature.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type Project = {
  name: string;
  repo: string;
  description: string;
  docsUrl?: string;
  logo: {
    src: string;
    darkSrc?: string;
    alt: string;
    className?: string;
  };
  accent: string;
};

const projects: Project[] = [
  {
    name: "Specta",
    repo: "specta-rs/specta",
    description:
      "Export your Rust types to any language. The foundation for type-safe communication across your stack.",
    docsUrl: "/docs/specta",
    logo: { src: "/assets/specta.svg", alt: "Specta logo" },
    accent: "#F4520A",
  },
  {
    name: "rspc",
    repo: "specta-rs/rspc",
    description:
      "A blazingly fast and typesafe RPC framework for Rust. Build web APIs with end-to-end type safety.",
    docsUrl: "/docs/rspc",
    logo: { src: "/assets/rspc.svg", alt: "rspc logo", className: "h-8 w-8" },
    accent: "#0092DE",
  },
  {
    name: "Tauri Specta",
    repo: "specta-rs/tauri-specta",
    description:
      "Typesafe Tauri commands with Specta. Build desktop apps with full type safety between Rust and TypeScript.",
    docsUrl: "/docs/tauri-specta",
    logo: {
      src: "/assets/tauri-specta.png",
      alt: "Tauri Specta logo",
      className: "h-6 w-14",
    },
    accent: "#D69A00",
  },
  {
    name: "Gurafi",
    repo: "specta-rs/gurafi",
    description:
      "An intuitive, type-safe, code-first GraphQL schema builder for Rust, built on the gql specification engine.",
    docsUrl: "/docs/gurafi",
    logo: {
      src: gurafiAppIcon,
      alt: "Gurafi app icon",
      className: "h-10 w-10",
    },
    accent: "#D9822B",
  },
  {
    name: "FSK",
    repo: "specta-rs/fsk",
    description:
      "Build cross-platform virtual file systems with a deliberately small Rust API and native macOS, Linux and Windows backends.",
    logo: {
      src: "/assets/fsk-light.svg",
      darkSrc: "/assets/fsk-dark.svg",
      alt: "FSK logo",
      className: "h-8 w-10",
    },
    accent: "#2B6CB0",
  },
];

function Projects() {
  return (
    <section className="sp-section">
      <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28">
        <SectionIntro
          index="02"
          label="Ecosystem"
          title="Our Projects"
          description="A collection of powerful, type-safe tools designed to work seamlessly together"
        />

        <div className="sp-cells grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.name}
              {...project}
              className={cn(
                index < 3 ? "lg:col-span-2" : "lg:col-span-3",
                projects.length % 2 === 1 &&
                  index === projects.length - 1 &&
                  "sm:col-span-2",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({
  name,
  repo,
  logo,
  description,
  docsUrl,
  accent,
  className,
}: Project & { className?: string }) {
  return (
    <article className={cn("sp-cell group flex flex-col p-7", className)}>
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] opacity-70"
        style={{ backgroundColor: accent }}
      />

      <div className="mb-7 flex items-start justify-between gap-3">
        <span
          className="flex size-14 items-center justify-center rounded-2xl border border-sp-line"
          style={{ backgroundColor: `${accent}12` }}
        >
          <img
            src={logo.src}
            alt={logo.alt}
            className={cn(
              "object-contain",
              logo.className ?? "h-8 w-12",
              logo.darkSrc && "dark:hidden",
            )}
          />
          {logo.darkSrc ? (
            <img
              src={logo.darkSrc}
              alt={logo.alt}
              className={cn(
                "hidden object-contain dark:block",
                logo.className ?? "h-8 w-12",
              )}
            />
          ) : null}
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-sp-line bg-sp-panel-strong px-2.5 py-1 font-mono text-[11px] text-fd-muted-foreground">
          <Star
            aria-hidden
            className="size-3 fill-sp-accent text-sp-accent"
            strokeWidth={0}
          />
          <span className="sr-only">GitHub stars: </span>
          {stars[repo] ?? "-"}
        </span>
      </div>

      <h3 className="text-[21px] font-semibold tracking-[-0.025em] transition-colors group-hover:text-sp-accent">
        {name}
      </h3>
      <p className="mt-2 grow text-[14.5px] leading-relaxed text-fd-muted-foreground">
        {description}
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {docsUrl ? (
          <a href={docsUrl} className={cn(primaryButton, "px-4")}>
            <BookOpen className="size-3.5" />
            Documentation
          </a>
        ) : null}
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener"
          className={cn(secondaryButton, "px-4", !docsUrl && "flex-1")}
        >
          <GitHubLogo className="size-3.5 dark:invert" />
          GitHub
        </a>
      </div>
    </article>
  );
}

function Support() {
  const direct = sponsors.filter((sponsor) => sponsor.tier === "direct");
  const github = sponsors.filter((sponsor) => sponsor.tier === "github");

  return (
    <section className="sp-section sp-section--soft">
      <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28">
        <SectionIntro
          index="03"
          label="Supporters"
          title="Support development"
          description="specta-rs is built and maintained by Oscar Beaumont. Sponsorships fund the time that goes into it."
        />

        <div className="mx-auto max-w-[960px]">
          <div className="sp-cells sm:grid-cols-2">
            {direct.map((sponsor) => (
              <a
                key={sponsor.name}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="sp-cell group flex items-center gap-4 p-5"
              >
                <img
                  src={sponsor.logo}
                  alt={`${sponsor.name} logo`}
                  className="size-12 rounded-xl border border-sp-line object-contain"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold tracking-[-0.015em]">
                    {sponsor.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] tracking-[0.1em] text-fd-muted-foreground uppercase">
                    Direct sponsor
                  </span>
                </span>
                <ArrowUpRight className="size-4 text-fd-muted-foreground transition-colors group-hover:text-sp-accent" />
              </a>
            ))}
          </div>

          {github.length > 0 ? (
            <div className="sp-panel mt-4 rounded-2xl p-5 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="shrink-0 font-mono text-[10px] font-medium tracking-[0.12em] text-fd-muted-foreground uppercase">
                  With thanks to
                </span>
                <div className="flex flex-wrap gap-2">
                  {github.map((sponsor) => (
                    <a
                      key={sponsor.name}
                      href={sponsor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 rounded-full border border-sp-line bg-sp-panel-strong/60 py-1.5 pr-3 pl-1.5 transition-colors hover:border-sp-accent-line hover:bg-sp-panel-strong"
                    >
                      <img
                        src={sponsor.logo}
                        alt={`${sponsor.name} logo`}
                        className="size-6 rounded-full"
                      />
                      <span className="text-[12px] font-medium text-fd-muted-foreground transition-colors group-hover:text-fd-foreground">
                        {sponsor.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/sponsors/oscartbeaumont"
              target="_blank"
              rel="noopener"
              className={cn(primaryButton, "px-6 py-3 text-sm")}
            >
              <Heart className="size-4" />
              Become a sponsor
            </a>
            <span className="text-[13px] text-fd-muted-foreground">
              or support through{" "}
              <a
                href="https://paypal.me/oscartbeaumont"
                target="_blank"
                rel="noopener"
                className="font-medium text-fd-foreground underline decoration-sp-accent-line underline-offset-4 transition-colors hover:text-sp-accent"
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

function CTASection() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="sp-cta mx-auto max-w-[1200px] rounded-[28px] px-6 py-14 text-center md:px-16 md:py-20">
        <h2 className="mx-auto max-w-[26ch] text-[clamp(1.9rem,4vw,2.85rem)] font-semibold tracking-[-0.035em] text-fd-foreground">
          Ready to build better web apps?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-fd-muted-foreground">
          Join the community and start building with specta-rs today
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/docs" className={cn(primaryButton, "px-6 py-3 text-sm")}>
            Documentation
            <BookOpen className="size-4" />
          </a>
          <a
            href="https://discord.com/invite/JgqH8b4ycw"
            target="_blank"
            rel="noopener"
            className={cn(secondaryButton, "px-6 py-3 text-sm")}
          >
            Join Discord
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionIntro({
  index,
  label,
  title,
  description,
}: {
  index: string;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-12 grid gap-5 md:mb-16 md:grid-cols-[1fr_minmax(0,380px)] md:items-end">
      <div>
        <p className="sp-eyebrow">
          <span className="text-fd-muted-foreground/70">{index}</span>
          {label}
        </p>
        <h2 className="sp-section__title mt-4">{title}</h2>
      </div>
      <p className="max-w-[380px] text-[14.5px] leading-relaxed text-fd-muted-foreground md:justify-self-end md:text-right">
        {description}
      </p>
    </div>
  );
}
