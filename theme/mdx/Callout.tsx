import { Callout as RspressCallout } from "@rspress/core/theme-original";
import type { ReactNode } from "react";

const calloutTypes = {
  warn: "warning",
  warning: "warning",
  idea: "tip",
  tip: "tip",
  note: "note",
  info: "info",
  error: "danger",
  danger: "danger",
} as const;

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: keyof typeof calloutTypes;
  title?: string;
  children: ReactNode;
}) {
  return (
    <RspressCallout type={calloutTypes[type] ?? "note"} title={title ?? ""}>
      {children}
    </RspressCallout>
  );
}

export default Callout;
