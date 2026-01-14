//
// This is a Vite plugin which can import `_headers` files and convert it to a JSON import.
//
// This is used so we can apply the same headers as Cloudflare would to static assets within a Solid Start `middleware.ts`.
// This workarounds the fact that Cloudflare doesn't apply `_headers` to requests which hit the Worker.
//

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

// Must match definition in `global.d.ts`
interface HeadersConfig {
  [path: string]: {
    [header: string]: string;
  };
}

function parseHeadersFile(content: string): HeadersConfig {
  const lines = content.split("\n");
  const result: HeadersConfig = {};
  let currentPath: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    // Check if this is a path pattern (not indented)
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      currentPath = trimmedLine;
      result[currentPath] = {};
    } else if (currentPath && trimmedLine.includes(":")) {
      // This is a header line (indented and contains ':')
      const colonIndex = trimmedLine.indexOf(":");
      const headerName = trimmedLine.substring(0, colonIndex).trim();
      const headerValue = trimmedLine.substring(colonIndex + 1).trim();

      if (headerName && headerValue) {
        result[currentPath][headerName] = headerValue;
      }
    }
  }

  return result;
}

export function headersPlugin(): Plugin {
  const VIRTUAL_MODULE_ID = "virtual:_headers";
  const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

  return {
    name: "vite-plugin-headers",
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const headersPath = join(process.cwd(), "public", "_headers");

        if (!existsSync(headersPath)) return "export default {};";

        try {
          const content = readFileSync(headersPath, "utf-8");
          const parsedHeaders = parseHeadersFile(content);

          return `export default ${JSON.stringify(parsedHeaders, null, 2)};`;
        } catch (error) {
          console.error("Error reading _headers file:", error);
          return "export default {};";
        }
      }
    },
    // Add file watching for hot reload during development
    buildStart() {
      const headersPath = join(process.cwd(), "public", "_headers");
      if (existsSync(headersPath)) this.addWatchFile(headersPath);
    },
  };
}
