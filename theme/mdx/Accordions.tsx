import type { ReactNode } from "react";

/**
 * FAQ-style groups read as one surface rather than a stack of loose cards, so
 * the wrapper owns the border and the accordions divide it into rows.
 */
export function Accordions({ children }: { children: ReactNode }) {
  return <div className="sp-accordions">{children}</div>;
}

export default Accordions;
