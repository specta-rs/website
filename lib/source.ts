import { docs, meta } from "../.source/server";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import Image from "next/image";
import { loader } from "fumadocs-core/source";
import { createElement } from "react";
import { CratesIoLogo, NpmLogo } from "./logos";

export const source = loader({
  baseUrl: "/docs",
  source: toFumadocsSource(docs, meta),
  icon(icon) {
    if (!icon) return;

    let result: [string, string];
    if (icon === "spectaLogo") {
      result = ["/images/logo.png", "Specta"];
    } else if (icon === "rspcLogo") {
      result = ["/images/rspc-logo.png", "rspc"];
    } else if (icon === "tauriSpectaLogo") {
      result = ["/images/tauri-specta-logo.png", "Tauri Specta"];
    } else if (icon === "docsRsLogo") {
      return createElement(CratesIoLogo);
    } else if (icon === "npmLogo") {
      return createElement(NpmLogo);
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
