import { source } from "@/lib/source";
import spectaPng from "../../../../../public/assets/specta.png?arraybuffer";
import ImageResponse from "@takumi-rs/image-response/wasm";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fs from "node:fs/promises";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug =
    url.pathname === "/og/docs"
      ? []
      : removePrefix(url.pathname, "/og/docs/").split("/");

  const page = source.getPage(slug);
  if (!page)
    return new Response("", {
      status: 404,
    });

  // This hackery can be fixed once Waku uses `@cloudflare/plugin-vite`:  https://github.com/wakujs/waku/issues/1245
  let module: any;
  if (import.meta.env.DEV)
    // This only works in development as it loads the wasm module dynamically which Cloudflare blocks in production.
    module = (await import("@takumi-rs/wasm/takumi_wasm_bg.wasm?arraybuffer"))
      .default;
  // We try the wasm import as during static rendering (which is done on node), this import will fail falling back to the catch case.
  else
    try {
      // This works in Cloudflare Workers due to the `waku.config.ts` marking it external.
      // This means the import isn't processed by Vite and when `wrangler deploy` is run,
      // it's build process sees it and properly bundles it.
      module = await import("@takumi-rs/wasm/takumi_wasm_bg.wasm");
    } catch (_) {
      // We are statically rendering on node so we can just import the wasm module.
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      module = await fs.readFile(
        resolve(
          __dirname,
          "..",
          (
            await import("@takumi-rs/wasm/takumi_wasm_bg.wasm?url")
          ).default.replace(/^\/+/, ""),
        ),
      );
    }

  return new ImageResponse(
    <OpenGraph
      title={page.data.longTitle || page.data.title}
      description={page.data.description}
    />,
    {
      module,
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: (
            await import(
              "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?arraybuffer"
            )
          ).default,
          weight: 100,
          style: "normal",
        },
      ],
      headers: {
        // Cache for 4 hours, allow usage another 4 hours if it's stale, or erroring.
        "Cache-Control":
          "public, max-age=14400, stale-while-revalidate=14400, stale-if-error=14400",
      },
    },
  );
}

function OpenGraph(props: { title: string; description?: string }) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        backgroundColor: "#0a0a0a",
        padding: "80px",
        fontFamily: "system-ui",
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(247, 76, 0, 0.25) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(244, 150, 0, 0.2) 0%, transparent 45%), radial-gradient(circle at 60% 80%, rgba(255, 107, 0, 0.18) 0%, transparent 50%), radial-gradient(circle at 10% 90%, rgba(206, 66, 43, 0.15) 0%, transparent 40%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <img
          src={`data:image/png;base64,${Buffer.from(spectaPng).toString("base64")}`}
          alt="Specta logo"
          style={{
            width: "100px",
            height: "100px",
            objectFit: "contain",
          }}
        />
        <div
          style={{
            fontSize: "42px",
            fontWeight: "bold",
            color: "white",
            letterSpacing: "-0.02em",
          }}
        >
          specta-rs
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: "900px",
          marginTop: "-40px",
        }}
      >
        <h1
          style={{
            fontSize: "72px",
            fontWeight: "bold",
            lineHeight: "1.1",
            color: "white",
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          {props.title}
        </h1>
        <p
          style={{
            fontSize: "32px",
            lineHeight: "1.4",
            color: "#a1a1aa",
            margin: 0,
            marginTop: "-12px",
          }}
        >
          {props.description}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "22px",
          color: "#71717a",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #F74C00 0%, #CE422B 100%)",
            }}
          />
          <span>Typesafety</span>
        </div>
        <span style={{ color: "#3f3f46" }}>•</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #F49600 0%, #FFC131 100%)",
            }}
          />
          <span>Developer experience</span>
        </div>
        <span style={{ color: "#3f3f46" }}>•</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #FF6B00 0%, #F74C00 100%)",
            }}
          />
          <span>Modern practices</span>
        </div>
        <span style={{ color: "#3f3f46" }}>•</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #CE422B 0%, #A03622 100%)",
            }}
          />
          <span>Scale</span>
        </div>
      </div>
    </div>
  );
}

export async function getConfig() {
  const pages = source
    .generateParams()
    .map((item) => (item.lang ? [item.lang, ...item.slug] : item.slug));

  return {
    // render: "static", // TODO: Fix this
    staticPaths: pages,
  } as const;
}

const removePrefix = (s: string, p: string) =>
  s.startsWith(p) ? s.slice(p.length) : s;
