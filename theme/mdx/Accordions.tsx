import type { ReactNode } from "react";

export function Accordions({ children }: { children: ReactNode }) {
  return <div className="not-prose my-4 flex flex-col gap-2">{children}</div>;
}

export default Accordions;
