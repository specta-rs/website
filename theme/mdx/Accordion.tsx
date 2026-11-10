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
    <details className="group rounded-lg border bg-fd-card [&::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-fd-accent/50">
        <span>{title}</span>
        <ChevronDown className="size-4 shrink-0 text-fd-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3 text-sm">{children}</div>
    </details>
  );
}

export default Accordion;
