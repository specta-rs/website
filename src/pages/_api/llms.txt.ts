import { getLLMText, isDeprecatedPage, source } from "@/lib/source";

export async function GET() {
  const scan = source
    .getPages()
    .filter(
      (page) =>
        !page.data.hidden &&
        !page.data.disableLlmsTxt &&
        !isDeprecatedPage(page.slugs),
    )
    .map(getLLMText);
  const scanned = await Promise.all(scan);

  return new Response(scanned.join("\n\n"));
}

export function getConfig() {
  return {
    render: "static",
  } as const;
}
