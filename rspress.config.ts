import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pluginLlms } from "@rspress/plugin-llms";
import {
  defineConfig,
  type PageIndexInfo,
  type RspressPlugin,
  type UserConfig,
} from "@rspress/core";
import { RouteService } from "@rspress/core/dist/node/route/RouteService.js";
import { scanSideMeta } from "@rspress/core/dist/node/auto-nav-sidebar/normalize.js";
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss";
import { ImageResponse } from "takumi-js/response";
import { OpenGraph, logoSource } from "./theme/og";
import { canonical, ogRoute, openGraphImageSize } from "./theme/site-meta";
import { projects } from "./theme/projects";
import { remarkPackageManagerTabs } from "./scripts/remark-package-manager";

const contentRoot = path.resolve("content");
const docsRoot = path.join(contentRoot, "docs");
const extensions = [".mdx", ".md"];

// Filled by `extendPageData` before the Markdown copies are generated. The
// plugin needs the page title to prepend the `# Heading` that the old
// `llms.mdx` endpoints included.
const pageTitles = new Map<string, string>();

/**
 * Rewrite the Fumadocs `filename=` code fence metadata to the `title=` syntax
 * Rspress understands. There are around fifty fences using it, so normalising
 * them in the pipeline is less churn than editing every guide.
 */
function remarkFilenameToTitle() {
  return (tree: { children?: unknown[] }) => {
    const walk = (node: any) => {
      if (node.type === "code" && typeof node.meta === "string") {
        node.meta = node.meta.replace(/\bfilename=/g, "title=");
      }
      if (Array.isArray(node.children))
        for (const child of node.children) walk(child);
    };
    walk(tree);
  };
}

/**
 * The version switcher is navigation rather than content, and generated pages
 * carry import/export syntax that does not belong in a Markdown copy.
 */
function remarkTidyGeneratedMarkdown() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!Array.isArray(node.children)) return;
      const next: any[] = [];
      for (const child of node.children) {
        if (child.type === "mdxjsEsm") continue;

        if (
          child.type === "mdxJsxFlowElement" &&
          child.name === "ReferenceHeader"
        ) {
          continue;
        }

        walk(child);
        next.push(child);
      }
      node.children = next;
    };
    walk(tree);
  };
}

/**
 * Markdown copies start with the page title, matching the old `llms.mdx`
 * endpoints. The title is not part of the MDX body because Rspress renders it
 * from frontmatter instead.
 */
function remarkPrependTitle() {
  return (tree: any, file: { path?: string }) => {
    const title = file.path ? pageTitles.get(file.path) : undefined;
    if (!title) return;
    tree.children.unshift({
      type: "heading",
      depth: 1,
      children: [{ type: "text", value: title }],
    });
  };
}

// Both `pluginLlms` instances below need the same remark pipeline: one emits a
// Markdown copy of every page, the other builds the filtered llms.txt output.
const markdownFileOptions = {
  remarkPlugins: [remarkTidyGeneratedMarkdown, remarkPrependTitle],
};

function isIndexable(page: PageIndexInfo) {
  return page.frontmatter?.search !== false;
}

function isLLMsPage(page: PageIndexInfo) {
  return isIndexable(page) && page.frontmatter?.disableLlmsTxt !== true;
}

function createSitePlugin(): RspressPlugin {
  const pages = new Map<string, PageIndexInfo>();

  return {
    name: "specta-site",
    extendPageData(pageData) {
      pages.set(pageData.routePath, pageData);
      pageTitles.set(pageData._filepath, pageData.title);

      // Keep symbol listings out of the table of contents for generated pages.
      if (pageData.frontmatter.generated) {
        pageData.toc = pageData.toc.filter((item) => item.depth <= 2);
      }
    },
    async afterBuild(config) {
      const outDir = path.resolve(config.outDir ?? "doc_build");
      const [logo, font] = await Promise.all([
        readFile(path.resolve("public/assets/specta.png")),
        readFile(
          path.resolve(
            "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
          ),
        ),
      ]);

      const entries: { loc: string; lastmod?: string }[] = [
        { loc: `${canonical}/` },
      ];

      for (const pageData of pages.values()) {
        if (isIndexable(pageData) && pageData.routePath !== "/") {
          let lastmod: string | undefined;
          try {
            lastmod = (await stat(pageData._filepath)).mtime.toISOString();
          } catch {
            // Generated or virtual pages may not have a source file.
          }
          entries.push({ loc: `${canonical}${pageData.routePath}`, lastmod });
        }

        // Every page gets its own card. The landing page writes `/og.png`.
        const image = new ImageResponse(
          OpenGraph({
            title: pageData.title,
            description: pageData.description,
          }),
          {
            width: openGraphImageSize[0],
            height: openGraphImageSize[1],
            fonts: [
              { name: "Inter", data: font, weight: 100, style: "normal" },
            ],
            images: [{ src: logoSource, data: logo }],
          },
        );
        const target = path.join(outDir, ogRoute(pageData.routePath));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(await image.arrayBuffer()));
      }

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(({ loc, lastmod }) =>
    lastmod
      ? `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
      : `  <url>\n    <loc>${loc}</loc>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;
      await writeFile(path.join(outDir, "sitemap.xml"), sitemap);
    },
  };
}

/**
 * Rspress gives index pages a trailing-slash link. Cloudflare's
 * `drop-trailing-slash` handling then redirects every click, and Markdown
 * negotiation has to follow the same redirect. Normalise the links once here.
 */
function normalizeSidebarLinks(
  items: Awaited<ReturnType<typeof scanSideMeta>>,
): Awaited<ReturnType<typeof scanSideMeta>> {
  return items.map((item) => {
    const next = { ...item } as typeof item & { items?: typeof items };
    if ("items" in next && Array.isArray(next.items)) {
      next.items = normalizeSidebarLinks(next.items);
    }
    if (
      "link" in next &&
      typeof next.link === "string" &&
      next.link.length > 1 &&
      next.link.endsWith("/")
    ) {
      next.link = next.link.slice(0, -1);
    }
    return next;
  });
}

async function createSidebar() {
  // `scanSideMeta` needs a RouteService to resolve page files to route paths.
  // Initialising one here (Rspress replaces it during the build) lets us read
  // each project's `_meta.json` with the same logic as the auto sidebar.
  await RouteService.create({
    scanDir: contentRoot,
    config: {
      root: contentRoot,
      route: { extensions },
    } as UserConfig,
    externalPages: [],
  });

  const metaFileSet = new Set<string>();
  const mdFileSet = new Set<string>();
  const sidebar: Record<string, Awaited<ReturnType<typeof scanSideMeta>>> = {};

  // One sidebar per project keeps the navigation focused on the project the
  // reader is in. The project switcher above the sidebar handles navigation
  // between projects.
  for (const project of projects) {
    sidebar[`/docs/${project.id}`] = normalizeSidebarLinks(
      await scanSideMeta(
        path.join(docsRoot, project.id),
        contentRoot,
        extensions,
        metaFileSet,
        mdFileSet,
      ),
    );
  }

  // The docs landing page has no project selected, so it only lists itself.
  // Its `_meta.json` no longer pulls in the project directories.
  sidebar["/docs"] = normalizeSidebarLinks(
    await scanSideMeta(
      docsRoot,
      contentRoot,
      extensions,
      metaFileSet,
      mdFileSet,
    ),
  );

  return sidebar;
}

const sidebar = await createSidebar();

export default defineConfig({
  root: contentRoot,
  title: "specta-rs",
  description:
    "An ecosystem of crates focused on typesafety, developer experience, modern practices allowing you to build faster and deploy with confidence.",
  siteOrigin: canonical,
  lang: "en",
  logo: "/assets/specta.png",
  logoText: "Specta",
  logoHref: "/",
  sitemap: false,
  llms: false,
  globalStyles: path.resolve("theme/styles.css"),
  i18nSource: (value) => {
    value.editLinkText.en = "Edit on GitHub";
    value.lastUpdatedText.en = "Last updated on";
    return value;
  },
  themeConfig: {
    darkMode: true,
    nav: [
      { text: "Docs", link: "/docs/specta" },
      { text: "About", link: "/about" },
    ],
    sidebar,
    lastUpdated: true,
    editLink: {
      docRepoBaseUrl: "https://github.com/specta-rs/website/blob/main/content/",
    },
    socialLinks: [
      {
        icon: "discord",
        mode: "link",
        content: "https://discord.com/invite/JgqH8b4ycw",
      },
      {
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.5-3-5.5"/></svg>',
        },
        mode: "link",
        content: "https://github.com/sponsors/oscartbeaumont",
      },
      {
        icon: "github",
        mode: "github-stars",
        content: "https://github.com/specta-rs",
      },
    ],
    fallbackHeadingTitle: false,
    llmsUI: false,
  },
  markdown: {
    remarkPlugins: [remarkFilenameToTitle, remarkPackageManagerTabs],
    image: { checkDeadImages: false },
    shiki: {
      // Render any future unknown language as plain text instead of failing
      // the build. `npm` fences are converted to package-manager tabs by
      // `remarkPackageManagerTabs`.
      fallbackLanguage: "txt",
      langs: [
        "tsx",
        "ts",
        "js",
        "typescript",
        "rust",
        "rs",
        "bash",
        "sh",
        "shell",
        "toml",
        "svelte",
        "graphql",
        "json",
        "html",
        "css",
        "diff",
      ],
    },
    globalComponents: [
      path.resolve("theme/mdx/Callout.tsx"),
      path.resolve("theme/mdx/Accordions.tsx"),
      path.resolve("theme/mdx/Accordion.tsx"),
      path.resolve("theme/mdx/ReferenceHeader.tsx"),
      path.resolve("theme/mdx/PackageManagerCommands.tsx"),
    ],
  },
  builderConfig: {
    plugins: [pluginTailwindcss()],
    server: {
      publicDir: { name: path.resolve("public") },
    },
    resolve: {
      alias: {
        "@": path.resolve("src"),
      },
    },
  },
  plugins: [
    createSitePlugin(),
    pluginLlms([
      {
        // Emit a Markdown copy of every page, including drafts and deprecated
        // releases. Those pages are still reachable by URL and by search.
        include: () => true,
        mdFiles: markdownFileOptions,
        llmsTxt: false,
        llmsFullTxt: false,
      },
      {
        // Only the pages we want indexed go into llms.txt / llms-full.txt.
        include: ({ page }) => isLLMsPage(page),
        mdFiles: markdownFileOptions,
        llmsTxt: { name: "llms.txt" },
        llmsFullTxt: { name: "llms-full.txt" },
      },
    ]),
  ],
});
