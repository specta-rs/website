"use client";

export const SpectaLogoWithRightClickForBrand = () => (
  // Right-click is the only interaction; the element is not meant to be a
  // focusable control.
  <div
    className="inline-flex items-center gap-2.5 "
    onContextMenu={(e) => {
      e.preventDefault();
      window.location.href = "/docs/brand";
    }}
  >
    <img src="/assets/specta.png" alt="Specta Logo" className="h-8 w-12" />

    <span>Specta</span>
  </div>
);
