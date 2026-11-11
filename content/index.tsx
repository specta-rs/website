import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Briefcase,
  Code2,
  ExternalLink,
  Heart,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useState } from "react";
import { DiscordLogo, GitHubLogo } from "@/components/logos";
import { cn } from "@/lib/utils";
import siteData from "../theme/site-data.json";
import { gurafiAppIcon } from "../theme/gurafi-icon";

export const frontmatter = {
  pageType: "custom",
};

const stars = siteData.stars as Record<string, string>;
const sponsors = siteData.sponsors;
const downloads = siteData.downloads as number;
const downloadsLabel = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
}).format(downloads);

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
  "sp-button sp-button--primary inline-flex items-center justify-center gap-2 rounded-full bg-sp-cta px-5 py-2.5 text-[13px] font-semibold text-sp-cta-foreground shadow-[0_10px_30px_-12px_var(--sp-accent-glow)] transition-colors hover:bg-sp-cta-hover";
const secondaryButton =
  "sp-button sp-button--secondary inline-flex items-center justify-center gap-2 rounded-full border border-sp-line bg-sp-panel/70 px-5 py-2.5 text-[13px] font-semibold text-fd-foreground transition-colors hover:border-sp-accent-line hover:bg-sp-accent-soft";

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
          <h1 className="sp-hero__title">
            Build better web apps with{" "}
            <span className="sp-hero__rust">Rust</span>
          </h1>

          <p className="sp-hero__subtitle mt-6 max-w-[560px] text-[16px] leading-relaxed text-fd-muted-foreground sm:text-[17px]">
            An ecosystem of crates focused on typesafety, developer experience,
            modern practices which scales to large codebases allowing you to
            build faster and deploy with confidence.
          </p>

          <div className="sp-hero__actions mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/docs/specta"
              className={cn(primaryButton, "px-6 py-3 text-sm")}
            >
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

          <div className="sp-hero__stats mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
            <div className="sp-hero__stat">
              <strong>{totalStars}</strong>
              <span>GitHub stars</span>
            </div>
            <div className="sp-hero__stat">
              <strong>{downloadsLabel}</strong>
              <span>crates.io downloads</span>
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
 * the Specta getting-started guide, with the generated output cycling through
 * the exporters.
 */
type CodeToken = [
  text: string,
  kind?: "key" | "type" | "str" | "fn" | "punc" | "comment",
];

const token = (text: string, kind?: CodeToken[1]): CodeToken => [text, kind];

const languageOutputs = [
  {
    id: "typescript",
    label: "TypeScript",
    file: "generated bindings.ts",
    lines: [
      [
        token("export type", "key"),
        token(" "),
        token("User", "fn"),
        token(" = {"),
      ],
      [
        token("  id"),
        token(":", "punc"),
        token(" "),
        token("number", "type"),
        token(";", "punc"),
      ],
      [
        token("  name"),
        token(":", "punc"),
        token(" "),
        token("string", "type"),
        token(";", "punc"),
      ],
      [token("};", "punc")],
    ],
  },
  {
    id: "jsdoc",
    label: "JSDoc",
    file: "generated bindings.js",
    lines: [
      [token("/**", "comment")],
      [token(" * @typedef {Object} User", "comment")],
      [token(" * @property {number} id", "comment")],
      [token(" * @property {string} name", "comment")],
      [token(" */", "comment")],
    ],
  },
  {
    id: "swift",
    label: "Swift",
    file: "generated Types.swift",
    lines: [
      [
        token("public struct", "key"),
        token(" "),
        token("User", "fn"),
        token(":", "punc"),
        token(" Codable", "type"),
        token(" {", "punc"),
      ],
      [
        token("  public let", "key"),
        token(" id"),
        token(":", "punc"),
        token(" "),
        token("UInt32", "type"),
      ],
      [
        token("  public let", "key"),
        token(" name"),
        token(":", "punc"),
        token(" "),
        token("String", "type"),
      ],
      [token("}", "punc")],
    ],
  },
  {
    id: "go",
    label: "Go",
    file: "generated bindings.go",
    lines: [
      [token("package", "key"), token(" bindings")],
      [token("")],
      [
        token("type", "key"),
        token(" "),
        token("User", "fn"),
        token(" struct", "key"),
        token(" {", "punc"),
      ],
      [token("  Id   "), token("uint32", "type"), token(' `json:"id"`', "str")],
      [
        token("  Name "),
        token("string", "type"),
        token(' `json:"name"`', "str"),
      ],
      [token("}", "punc")],
    ],
  },
  {
    id: "kotlin",
    label: "Kotlin",
    file: "generated Bindings.kt",
    lines: [
      [
        token("public data class", "key"),
        token(" "),
        token("User", "fn"),
        token("(", "punc"),
      ],
      [
        token("    val", "key"),
        token(" id"),
        token(":", "punc"),
        token(" "),
        token("kotlin.UInt", "type"),
        token(","),
      ],
      [
        token("    val", "key"),
        token(" name"),
        token(":", "punc"),
        token(" "),
        token("kotlin.String", "type"),
      ],
      [token(")", "punc")],
    ],
  },
  {
    id: "java",
    label: "Java",
    file: "generated Bindings.java",
    lines: [
      [
        token("public record", "key"),
        token(" "),
        token("User", "fn"),
        token("(", "punc"),
      ],
      [token("    "), token("java.lang.Long", "type"), token(" id,")],
      [token("    "), token("java.lang.String", "type"), token(" name")],
      [token(") {}", "punc")],
    ],
  },
  {
    id: "zod",
    label: "Zod",
    file: "generated schemas.ts",
    lines: [
      [
        token("export const", "key"),
        token(" "),
        token("UserSchema", "fn"),
        token(" = z.object({", "punc"),
      ],
      [
        token("  id"),
        token(":", "punc"),
        token(" "),
        token("z.int().min(0).max(4294967295)", "type"),
        token(","),
      ],
      [
        token("  name"),
        token(":", "punc"),
        token(" "),
        token("z.string()", "type"),
        token(","),
      ],
      [token("});", "punc")],
    ],
  },
  {
    id: "valibot",
    label: "Valibot",
    file: "generated schemas.ts",
    lines: [
      [
        token("export const", "key"),
        token(" "),
        token("UserSchema", "fn"),
        token(" = $spectaObject({", "punc"),
      ],
      [token("  id"), token(":", "punc"), token(" "), token("v.pipe(", "type")],
      [token("    "), token("v.number(), v.integer(),", "type")],
      [token("    "), token("v.minValue(0), v.maxValue(4294967295),", "type")],
      [token("  ),", "punc")],
      [
        token("  name"),
        token(":", "punc"),
        token(" "),
        token("v.string()", "type"),
        token(","),
      ],
      [token("});", "punc")],
    ],
  },
  {
    id: "openapi",
    label: "OpenAPI",
    file: "generated openapi.json",
    lines: [
      [token('"User"', "str"), token(": {")],
      [
        token('  "type"', "str"),
        token(": "),
        token('"object"', "str"),
        token(","),
      ],
      [token('  "properties"', "str"), token(": {")],
      [
        token('    "id"', "str"),
        token(": { "),
        token('"type"', "str"),
        token(": "),
        token('"integer"', "str"),
        token(" },"),
      ],
      [
        token('    "name"', "str"),
        token(": { "),
        token('"type"', "str"),
        token(": "),
        token('"string"', "str"),
        token(" }"),
      ],
      [token("  }")],
      [token("}")],
    ],
  },
];

function CodeLines({ lines }: { lines: CodeToken[][] }) {
  return (
    <>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? "\n" : null}
          {line.map(([text, kind], tokenIndex) =>
            kind ? (
              <span key={tokenIndex} className={`tok-${kind}`}>
                {text}
              </span>
            ) : (
              <Fragment key={tokenIndex}>{text}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

function TypeBridge() {
  const [active, setActive] = useState(0);
  const output = languageOutputs[active];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const next = (active + 1) % languageOutputs.length;
    const timer = window.setTimeout(() => setActive(next), 4000);

    return () => window.clearTimeout(timer);
  }, [active]);

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

        <div className="sp-code__divider">{output.file}</div>

        <pre className="sp-code sp-code-panel__output" key={output.id}>
          <code>
            <CodeLines lines={output.lines} />
          </code>
        </pre>

        <div
          className="sp-code-panel__foot"
          role="group"
          aria-label="Generated output language"
        >
          {languageOutputs.map((language, index) => (
            <button
              key={language.id}
              type="button"
              aria-pressed={index === active}
              className="sp-code-panel__chip"
              onClick={() => setActive(index)}
            >
              {language.label}
            </button>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">
        A Rust User struct deriving Specta's Type trait, and the generated
        bindings in TypeScript, Swift, Go, JSDoc and OpenAPI.
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
      <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-20">
        <SectionIntro
          index="01"
          label="Philosophy"
          title="Why specta-rs?"
          compact
        />

        <div className="sp-cells sm:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="sp-cell p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="sp-icon-tile shrink-0">
                    <Icon className="size-5" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[17px] font-semibold tracking-[-0.02em]">
                        {feature.title}
                      </h3>
                      <span className="font-mono text-[10px] tracking-[0.12em] text-fd-muted-foreground/60">
                        0{index + 1}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-fd-muted-foreground">
                      {feature.body}
                    </p>
                  </div>
                </div>
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
    frameClassName?: string;
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
    name: "Tauri Specta",
    repo: "specta-rs/tauri-specta",
    description:
      "Typesafe Tauri commands with Specta. Build desktop apps with full type safety between Rust and TypeScript.",
    docsUrl: "/docs/tauri-specta",
    logo: {
      src: "/assets/tauri-specta.png",
      alt: "Tauri Specta logo",
      className: "h-14 w-[123px]",
      frameClassName: "w-[123px]",
    },
    accent: "#D69A00",
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
    name: "Gurafi",
    repo: "specta-rs/gurafi",
    description:
      "An intuitive, type-safe, code-first GraphQL schema builder for Rust, built on the gql specification engine.",
    docsUrl: "/docs/gurafi",
    logo: {
      src: gurafiAppIcon,
      alt: "Gurafi app icon",
      className: "h-[54px] w-[54px]",
    },
    accent: "#D9822B",
  },
  {
    name: "FSK",
    repo: "specta-rs/fsk",
    description:
      "Build cross-platform virtual file systems with a deliberately small Rust API and native macOS, Linux and Windows backends.",
    docsUrl: "/docs/fsk",
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
        <SectionIntro index="02" label="Ecosystem" title="Our Projects" />

        <div className="sp-cells grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.name}
              {...project}
              className={cn(
                index < 2 ? "lg:col-span-3" : "lg:col-span-2",
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
    <article
      className={cn(
        "sp-cell sp-project-card group flex flex-col p-7",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] opacity-70"
        style={{ backgroundColor: accent }}
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sp-line",
              logo.frameClassName,
            )}
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

          <h3 className="min-w-0 text-[21px] font-semibold tracking-[-0.025em] transition-colors group-hover:text-sp-accent">
            {name}
          </h3>
        </div>

        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-sp-line bg-sp-panel-strong px-2.5 py-1 font-mono text-[11px] text-fd-muted-foreground">
          <Star
            aria-hidden
            className="size-3 fill-sp-accent text-sp-accent"
            strokeWidth={0}
          />
          <span className="sr-only">GitHub stars: </span>
          {stars[repo] ?? "-"}
        </span>
      </div>

      <p className="grow text-[14.5px] leading-relaxed text-fd-muted-foreground">
        {description}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-sp-line pt-4">
        {docsUrl ? (
          <a
            href={docsUrl}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-sp-accent transition-colors hover:text-sp-accent/85"
          >
            <BookOpen className="size-3.5" />
            Documentation
          </a>
        ) : (
          <span />
        )}
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          <GitHubLogo className="size-3.5 dark:invert" />
          GitHub
          <ArrowUpRight className="size-3" />
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
          description={
            <>
              maintained by{" "}
              <a
                href="https://otbeaumont.me"
                target="_blank"
                rel="noopener"
                className="font-medium text-fd-foreground underline decoration-sp-accent-line underline-offset-4 transition-colors hover:text-sp-accent"
              >
                Oscar Beaumont
              </a>
            </>
          }
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
                    Previous sponsor
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

          <div className="sp-cells mt-8 sm:grid-cols-2">
            <div className="sp-cell flex flex-col gap-5 p-6 md:p-7">
              <span className="sp-icon-tile">
                <Heart aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-semibold tracking-[-0.015em]">
                  Become a sponsor
                </h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-fd-muted-foreground">
                  Fund the ongoing development of the ecosystem, or support
                  through{" "}
                  <a
                    href="https://paypal.me/oscartbeaumont"
                    target="_blank"
                    rel="noopener"
                    className="font-medium text-fd-foreground underline decoration-sp-accent-line underline-offset-4 transition-colors hover:text-sp-accent"
                  >
                    PayPal
                  </a>
                  .
                </p>
              </div>
              <a
                href="https://github.com/sponsors/oscartbeaumont"
                target="_blank"
                rel="noopener"
                className={cn(primaryButton, "mt-auto w-full shadow-none")}
              >
                <Heart className="size-4" />
                Sponsor on GitHub
              </a>
            </div>

            <a
              href="/consulting"
              className="sp-cell group flex flex-col gap-5 p-6 md:p-7"
            >
              <span className="sp-icon-tile">
                <Briefcase aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold tracking-[-0.015em] transition-colors group-hover:text-sp-accent">
                  Work with me
                </span>
                <span className="mt-1 block text-[13.5px] leading-relaxed text-fd-muted-foreground">
                  Contract development and team training from the creator of
                  Specta.
                </span>
              </span>
              <span
                className={cn(secondaryButton, "mt-auto w-full text-sp-accent")}
              >
                Learn more
                <ArrowUpRight
                  aria-hidden
                  className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </span>
            </a>
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
          <a
            href="/docs/specta"
            className={cn(primaryButton, "px-6 py-3 text-sm")}
          >
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
  compact,
}: {
  index: string;
  label: string;
  title: string;
  description?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-5 md:grid-cols-[1fr_minmax(0,380px)] md:items-end",
        compact ? "mb-8 md:mb-10" : "mb-12 md:mb-16",
      )}
    >
      <div>
        <p className="sp-eyebrow">
          <span className="text-fd-muted-foreground/70">{index}</span>
          {label}
        </p>
        <h2 className="sp-section__title mt-4">{title}</h2>
      </div>
      {description ? (
        <p className="max-w-[380px] text-[14.5px] leading-relaxed text-fd-muted-foreground md:justify-self-end md:text-right">
          {description}
        </p>
      ) : null}
    </div>
  );
}
