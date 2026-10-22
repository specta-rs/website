import { getLLMsFull } from "@/lib/source";

export async function GET() {
  return new Response(await getLLMsFull(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function getConfig() {
  return {
    render: "static",
  } as const;
}
