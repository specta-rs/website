"use client";

import { useEffect } from "react";

const socialLabels: [string, string][] = [
  ["discord", "Discord community"],
  ["sponsors", "Sponsor on GitHub"],
  ["github.com", "GitHub repository"],
];

function labelSocialLinks() {
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    ".rp-social-links__item",
  )) {
    if (link.hasAttribute("aria-label")) continue;
    const href = link.getAttribute("href") ?? "";
    const match = socialLabels.find(([needle]) => href.includes(needle));
    if (!match) continue;
    link.setAttribute("aria-label", match[1]);
    link.setAttribute("title", match[1]);
  }
}

function makeKeyboardButton(
  element: Element | null,
  label: string,
  handler?: () => void,
) {
  if (!(element instanceof Element)) return;
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", label);
  if (element.hasAttribute("data-a11y-keyboard")) return;
  element.setAttribute("data-a11y-keyboard", "true");
  element.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== "Enter" && key !== " ") return;
    event.preventDefault();
    if (handler) handler();
    else
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
  });
}

function decorateThemeToggles() {
  for (const toggle of document.querySelectorAll(".rp-switch-appearance")) {
    makeKeyboardButton(toggle, "Toggle color theme");
  }
}

function decorateSearch() {
  const modal = document.querySelector(".rp-search-panel__modal");
  if (modal) {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Search documentation");
  }

  makeKeyboardButton(
    document.querySelector(".rp-search-panel__cancel"),
    "Close search",
  );
  makeKeyboardButton(
    document.querySelector(".rp-search-panel__close"),
    "Clear search",
  );
}

/**
 * Rspress leaves a couple of interactive surfaces without names or button
 * semantics. Patch them after mount (and after the search portal or mobile
 * drawer mounts) without touching the components that own their behaviour.
 */
export function AccessibilityFixes() {
  useEffect(() => {
    const apply = () => {
      labelSocialLinks();
      decorateThemeToggles();
      decorateSearch();
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
