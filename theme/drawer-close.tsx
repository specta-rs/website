"use client";

import { X } from "lucide-react";

/**
 * The mobile documentation drawer covers the "Menu" trigger, so the only way
 * back out was to tap the narrow strip beside it. Put a real close control at
 * the top of the drawer; it dismisses through the same backdrop as a tap.
 */
export function DrawerClose() {
  return (
    <button
      type="button"
      className="sp-drawer-close"
      aria-label="Close navigation"
      onClick={() => {
        document.querySelector<HTMLElement>(".rp-sidebar-menu__mask")?.click();
      }}
    >
      <X aria-hidden className="size-3.5" />
      Close
    </button>
  );
}
