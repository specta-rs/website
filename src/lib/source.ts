import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { icons } from "lucide-react";
import { createElement } from "react";
import { CratesIoLogo, NpmLogo } from "../components/logos";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
  icon(icon) {
    if (!icon) return;

    let result: [string, string, string];
    if (icon === "spectaLogo") {
      result = ["/assets/specta.png", "Specta", "w-[24px]"];
    } else if (icon === "rspcLogo") {
      result = ["/assets/rspc.png", "rspc", "w-[16px]"];
    } else if (icon === "tauriSpectaLogo") {
      result = ["/assets/tauri-specta.png", "Tauri Specta", "w-[35px]"];
    } else if (icon === "docsRsLogo") {
      return createElement(CratesIoLogo);
    } else if (icon === "npmLogo") {
      return createElement(NpmLogo);
    } else if (icon && icon in icons && icons[icon as keyof typeof icons]) {
      return createElement(icons[icon as keyof typeof icons]);
    } else throw new Error(`Requested unknown icon: ${icon}`);

    const [src, alt, widthClass] = result;
    return createElement("img", {
      src,
      alt,
      width: 24,
      height: 24,
      className: `h-4 ${widthClass}`,
    });
  },
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "og.png"];

  return {
    segments,
    url: `/docs/${segments.join("/")}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.longTitle || page.data.title}

${processed}`;
}
