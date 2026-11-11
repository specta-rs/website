"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

const sidebarSelector = ".rp-doc-layout__sidebar";
const triggerSelector = ".rp-sidebar-menu__left";
const maskSelector = ".rp-sidebar-menu__mask";

/**
 * The mobile documentation drawer covers the "Menu" trigger, so the only way
 * back out was to tap the narrow strip beside it. Put a real close control at
 * the top of the drawer and keep it in reach when the navigation scrolls.
 *
 * The drawer is also the only navigation on phones, so move focus into it when
 * it opens, hand focus back to the trigger when it closes, and let Escape do
 * the same as the button.
 */
export function DrawerClose() {
  const restoreFocus = useRef(false);

  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>(sidebarSelector);
    const trigger = document.querySelector<HTMLElement>(triggerSelector);
    if (!sidebar || !trigger) return;

    if (!sidebar.id) sidebar.id = "sp-mobile-sidebar";
    trigger.setAttribute("aria-controls", sidebar.id);

    const isOpen = () =>
      sidebar.classList.contains("rp-doc-layout__sidebar--open");

    const sync = (open: boolean) => {
      trigger.setAttribute("aria-expanded", String(open));
      if (open) {
        // Focus the close control rather than leaving focus behind the drawer.
        sidebar
          .querySelector<HTMLElement>(".sp-drawer-close")
          ?.focus({ preventScroll: true });
      } else if (restoreFocus.current) {
        restoreFocus.current = false;
        trigger.focus({ preventScroll: true });
      }
    };

    let wasOpen = isOpen();
    trigger.setAttribute("aria-expanded", String(wasOpen));

    const observer = new MutationObserver(() => {
      const open = isOpen();
      if (open === wasOpen) return;
      wasOpen = open;
      sync(open);
    });
    observer.observe(sidebar, { attributes: true, attributeFilter: ["class"] });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isOpen()) return;
      event.preventDefault();
      restoreFocus.current = true;
      document.querySelector<HTMLElement>(maskSelector)?.click();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <button
      type="button"
      className="sp-drawer-close"
      aria-label="Close navigation"
      onClick={() => {
        restoreFocus.current = true;
        document.querySelector<HTMLElement>(maskSelector)?.click();
      }}
    >
      <X aria-hidden className="size-3.5" />
      Close
    </button>
  );
}
