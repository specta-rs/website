import { getLLMsIndex } from "@/lib/source";

export async function GET() {
  return new Response(await getLLMsIndex(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function getConfig() {
  return {
    render: "static",
  } as const;
}
