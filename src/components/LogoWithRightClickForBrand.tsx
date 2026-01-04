"use client";

import Image from "next/image";

export const SpectaLogoWithRightClickForBrand = () => (
  // biome-ignore lint/a11y/noStaticElementInteractions: this is hidden
  <div
    className="inline-flex items-center gap-2.5 "
    onContextMenu={(e) => {
      e.preventDefault();
      window.location.href = "/docs/brand";
    }}
  >
    <Image
      src="/assets/specta.png"
      width={48}
      height={48}
      alt="Specta Logo"
      className="h-8 w-12"
    />

    <span>Specta</span>
  </div>
);
