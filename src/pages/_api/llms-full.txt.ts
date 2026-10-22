import { getLLMText, isDeprecatedPage, source } from "@/lib/source";

export async function GET() {
  const scanned = await Promise.all(
    source
      .getPages()
      .filter(
        (page) =>
          !page.data.hidden &&
          !page.data.disableLlmsTxt &&
          !isDeprecatedPage(page.slugs),
      )
      .map(getLLMText),
  );

  return new Response(scanned.join("\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function getConfig() {
  return {
    render: "static",
  } as const;
}
