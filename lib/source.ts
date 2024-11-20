import { docs, meta } from "@/.source";
import Image from "next/image";
import { createMDXSource } from "fumadocs-mdx";
import { loader } from "fumadocs-core/source";
import { createElement } from "react";

export const source = loader({
  baseUrl: "/docs",
  source: createMDXSource(docs, meta),
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }

    let src: string;
    if (icon === "spectaLogo") {
      src = "/images/logo.png";
    } else if (icon === "rspcLogo") {
      src = "/images/rspc-logo.png";
    } else if (icon === "tauriSpectaLogo") {
      src = "/images/tauri-specta-logo.png";
    } else {
      throw new Error(`Requested unknown icon: ${icon}`);
    }

    return createElement(Image, {
      src,
      alt: "todo",
      width: 24,
      height: 24,
    });
  },
});
