declare module "virtual:_headers" {
  // Must match definition in `vite-plugin-headers.ts`
  export interface HeadersConfig {
    [path: string]: {
      [header: string]: string;
    };
  }

  const headers: HeadersConfig;
  export default headers;
}
