import { DocsPageContent } from "@/components/docs-page-content";

export default function DocsIndexPage() {
  return <DocsPageContent slugs={[]} />;
}

export function getConfig() {
  return {
    render: "static",
  } as const;
}
