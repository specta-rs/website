export { GET } from "./docs/[...slug]";

export async function getConfig() {
  return {
    // render: "static",  // TODO: Fix this
  } as const;
}
