import { getLLMText, source } from "@/lib/source";
import type { ApiContext } from "waku/router";

export async function GET(
  _request: Request,
  { params }: ApiContext<"/_api/docs/[...slug]/llms.mdx">,
) {
  const slug = params.slug;
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
