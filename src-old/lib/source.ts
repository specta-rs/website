import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
// import { icons } from "lucide-react";
import Image from "next/image";
import { createElement } from "react";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
  icon(icon) {
    if (!icon) return;

    let result: [string, string];
    if (icon === "spectaLogo") {
      result = ["/assets/specta.png", "Specta"];
    } else if (icon === "rspcLogo") {
      result = ["/assets/rspc.png", "rspc"];
    } else if (icon === "tauriSpectaLogo") {
      result = ["/assets/tauri-specta.png", "Tauri Specta"];
    } else if (icon === "docsRsLogo") {
      return; // TODO: createElement(CratesIoLogo);
    } else if (icon === "npmLogo") {
      return; // TODO: createElement(NpmLogo);
    } else throw new Error(`Requested unknown icon: ${icon}`);

    const [src, alt] = result;
    return createElement(Image, {
      src,
      alt,
      width: 24,
      height: 24,
    });
  },
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title}

${processed}`;
}
