import { ImageResponse } from "next/og";

export const alt = "About Acme";
export const size = {
  width: 1600,
  height: 800,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          textAlign: "center",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          flexWrap: "nowrap",
          backgroundColor: "#0e111a",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* // TODO: It would be nice if these could from straight from the FS but Satori is annoying. */}
          <img
            src="https://raw.githubusercontent.com/specta-rs/website/main/public/images/logo.png"
            width="600px"
            height="400px"
          />
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Raleway",
            fontSize: 130,
            fontStyle: "normal",
            color: "white",
          }}
        >
          <b>specta-rs</b>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Raleway",
            fontSize: 54,
            fontStyle: "normal",
            marginTop: -40,
            color: "white",
          }}
        >
          <p>Rust crates for building better web apps</p>
        </div>
      </div>
    ),
    {
      width: 1600,
      height: 800,
      fonts: [
        {
          name: "Inter",
          data: await loadGoogleFont("Raleway:wght@500"),
          style: "normal",
          weight: 500,
        },
      ],
    },
  );
}

async function loadGoogleFont(font: string) {
  const url = `https://fonts.googleapis.com/css2?family=${font}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/,
  );

  if (resource) {
    const response = await fetch(resource[1]);
    if (response.status == 200) {
      return await response.arrayBuffer();
    }
  }

  throw new Error("failed to load font data");
}
