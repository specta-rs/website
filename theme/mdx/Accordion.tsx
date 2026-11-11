import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function Accordion({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="sp-accordion group">
      <summary className="sp-accordion__summary">
        <span className="sp-accordion__title">{title}</span>
        <span aria-hidden className="sp-accordion__toggle">
          <ChevronDown />
        </span>
      </summary>
      <div className="sp-accordion__content">{children}</div>
    </details>
  );
}

export default Accordion;
