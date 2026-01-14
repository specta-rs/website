import { getLLMText, source } from "@/lib/source";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = removeSuffix(url.pathname, "/llms.mdx");
  const slug = path === "/docs" ? [] : removePrefix(path, "/docs/").split("/");

  const page = source.getPage(slug);
  if (!page)
    return new Response("# 404 Not Found", {
      status: 404,
      headers: { "Content-Type": "text/markdown" },
    });

  return new Response(await getLLMText(page), {
    headers: {
      "Content-Type": "text/markdown",
    },
  });
}

export async function getConfig() {
  const pages = source
    .generateParams()
    .map((item) => (item.lang ? [item.lang, ...item.slug] : item.slug));

  return {
    render: "static",
    staticPaths: pages,
  } as const;
}

const removePrefix = (s: string, p: string) =>
  s.startsWith(p) ? s.slice(p.length) : s;

const removeSuffix = (s: string, p: string) =>
  s.endsWith(p) ? s.slice(0, -p.length) : s;
