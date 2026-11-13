"use client";

import { useEffect } from "react";

/**
 * Mermaid sizes a diagram to `width: 100%` and records the width it measured
 * only in an inline `max-width`, so a wide chart is squashed into the doc
 * column and its labels shrink to a few pixels. Give a chart that would lose
 * legibility its measured width; `theme/styles.css` then scrolls the wrapper.
 * A near-fit still scales into the column, because a scrollbar for a few pixels
 * is worse than the shrink.
 */
export function Diagrams() {
  useEffect(() => {
    const apply = () => {
      for (const svg of document.querySelectorAll<SVGSVGElement>(
        "svg[aria-roledescription]",
      )) {
        const natural = Number.parseFloat(svg.style.maxWidth);
        const available = svg.parentElement?.clientWidth ?? 0;
        if (!Number.isFinite(natural) || available === 0) continue;
        svg.style.width = natural > available * 1.05 ? `${natural}px` : "100%";
      }
    };

    apply();
    window.addEventListener("resize", apply);
    // The diagram mounts, and re-renders on a theme switch, after this effect.
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", apply);
      observer.disconnect();
    };
  }, []);

  return null;
}
