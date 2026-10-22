import { docs } from "fumadocs-mdx:collections/server";
import type { Item, Node, Root } from "fumadocs-core/page-tree";
import { type InferPageType, llms, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { icons } from "lucide-react";
import { createElement } from "react";
import { CratesIoLogo, GitHubLogo, NpmLogo } from "../components/logos";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
  icon(icon) {
    if (!icon) return;

    let result: [string, string, string];
    if (icon === "spectaLogo") {
      result = ["/assets/specta.png", "Specta", "h-5 w-[30px] max-w-none"];
    } else if (icon === "rspcLogo") {
      result = ["/assets/rspc.png", "rspc", "h-5 w-[20px] max-w-none"];
    } else if (icon === "tauriSpectaLogo") {
      // The Tauri Specta logo is a 2.19:1 lockup, so it needs the extra width
      // to stay legible next to the square-ish project logos.
      result = [
        "/assets/tauri-specta.png",
        "Tauri Specta",
        "h-5 w-[44px] max-w-none",
      ];
    } else if (icon === "docsRsLogo") {
      return createElement(CratesIoLogo);
    } else if (icon === "npmLogo") {
      return createElement(NpmLogo);
    } else if (icon === "Github" || icon === "GitHub") {
      return createElement(GitHubLogo);
    } else if (icon && icon in icons && icons[icon as keyof typeof icons]) {
      return createElement(icons[icon as keyof typeof icons]);
    } else throw new Error(`Requested unknown icon: ${icon}`);

    const [src, alt, className] = result;
    return createElement("img", {
      src,
      alt,
      width: 24,
      height: 24,
      className,
    });
  },
});

// Pages nested under `rspc/0.3.0` document a deprecated rspc release. They are
// kept for historical reference, but we show a deprecation banner and add a
// `noindex` meta tag so they don't compete with the current docs in search.
export function isDeprecatedPage(slugs: string[]): boolean {
  return slugs[0] === "rspc" && slugs[1] === "0.3.0";
}

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "og.png"];

  return {
    segments,
    url: `/docs/${segments.join("/")}`,
  };
}

// Generated reference pages keep their signatures in a lightweight `<pre>` so a
// package page does not ship hundreds of highlighted code blocks. That element is
// an implementation detail, so the Markdown endpoints turn it back into a fence
// and drop the version switcher, which is navigation rather than content.
const generatedPre = /^<pre className="[^"]*">\{(.*)\}<\/pre>$/gm;

function tidyGeneratedMarkdown(text: string) {
  return text
    .replace(/^<ReferenceHeader [^>]*\/>\n\n?/m, "")
    .replace(generatedPre, (_match, json: string) => {
      const code = JSON.parse(json) as string;
      const runs = code.match(/`+/g) ?? [];
      const ticks = "`".repeat(
        Math.max(3, ...runs.map((run) => run.length + 1)),
      );
      return `${ticks}ts\n${code}\n${ticks}`;
    });
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");
  const body = page.data.generated
    ? tidyGeneratedMarkdown(processed)
    : processed;

  return `# ${page.data.longTitle || page.data.title}

${body}`;
}

/**
 * Drafts (`hidden`) and the deprecated rspc 0.3.0 docs stay out of the
 * machine-readable outputs: the sitemap, the search index and `llms.txt`.
 */
export function isIndexable(page: InferPageType<typeof source>): boolean {
  return !page.data.hidden && !isDeprecatedPage(page.slugs);
}

/**
 * A page that is allowed in `llms.txt`/`llms-full.txt`. On top of
 * `isIndexable`, a page can opt out with `disableLlmsTxt`.
 */
function isLLMsPage(page: InferPageType<typeof source>): boolean {
  return isIndexable(page) && !page.data.disableLlmsTxt;
}

// Folder paths, relative to `content/docs`, that are excluded wholesale. A
// folder can hold external links (which have no page to inspect), so it needs
// its own check on top of `isIndexable`.
const EXCLUDED_FOLDER_PREFIXES = ["rspc/0.3.0"];

function isExcludedFolder(path: string | undefined): boolean {
  return (
    path !== undefined &&
    EXCLUDED_FOLDER_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  );
}

function isExcludedItem(item: Item): boolean {
  const page = source.getNodePage(item);
  return page ? !isLLMsPage(page) : false;
}

function pruneNode(node: Node): Node | null {
  if (node.type === "page") return isExcludedItem(node) ? null : node;
  if (node.type === "separator") return node;
  if (isExcludedFolder(node.$ref?.folder)) return null;

  const children = node.children
    .map(pruneNode)
    .filter((child): child is Node => child !== null);
  const index =
    node.index && !isExcludedItem(node.index) ? node.index : undefined;

  // A folder with nothing left to show is dropped entirely.
  if (children.length === 0 && !index) return null;

  return { ...node, children, index };
}

function pruneRoot(root: Root): Root {
  return {
    ...root,
    children: root.children
      .map(pruneNode)
      .filter((child): child is Node => child !== null),
    fallback: root.fallback ? pruneRoot(root.fallback) : undefined,
  };
}

// `llms()` builds the `llms.txt` index from the page tree, so excluded pages
// have to be pruned from the tree as well as from `getPages()`.
const llmsSource = Object.assign(Object.create(source) as typeof source, {
  getPages: (lang?: string) => source.getPages(lang).filter(isLLMsPage),
  getPageTree: (lang?: string) => pruneRoot(source.getPageTree(lang)),
});

/**
 * `llms.txt` — the index: a title, a summary and a link per page.
 */
export function getLLMsIndex() {
  return llms(llmsSource).index();
}

/**
 * `llms-full.txt` — the same pages, rendered in full.
 */
export function getLLMsFull() {
  return llms(llmsSource, { renderPage: getLLMText }).full();
}
