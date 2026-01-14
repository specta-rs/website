export { GET } from "./[...slug]/llms.mdx";

export function getConfig() {
  return {
    render: "static",
  } as const;
}
