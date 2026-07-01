import { openGraphImageSize } from "@/components/Meta";
import { getNonRootDocStaticPaths, source } from "@/lib/source";
import spectaLogoPng from "../../../../../public/assets/specta.png?arraybuffer";
import interFont from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?arraybuffer";
import { ImageResponse } from "@takumi-rs/image-response/wasm";

const spectaLogoSrc = "spectaLogo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = removeSuffix(url.pathname, "/og.png");
  const slug = path === "/docs" ? [] : removePrefix(path, "/docs/").split("/");

  const page = source.getPage(slug);
  if (!page)
    return new Response("", {
      status: 404,
    });

  return new ImageResponse(
    <OpenGraph
      title={page.data.longTitle || page.data.title}
      description={page.data.description}
    />,
    {
      width: openGraphImageSize[0],
      height: openGraphImageSize[1],
      fonts: [
        {
          name: "Inter",
          data: interFont,
          weight: 100,
          style: "normal",
        },
      ],
      persistentImages: [
        {
          src: spectaLogoSrc,
          data: spectaLogoPng,
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
          src={spectaLogoSrc}
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
  return {
    render: "static",
    staticPaths: getNonRootDocStaticPaths(),
  } as const;
}

const removePrefix = (s: string, p: string) =>
  s.startsWith(p) ? s.slice(p.length) : s;

const removeSuffix = (s: string, p: string) =>
  s.endsWith(p) ? s.slice(0, -p.length) : s;
