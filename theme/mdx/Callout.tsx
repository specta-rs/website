import { Info, Lightbulb, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

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

type CalloutKind = (typeof calloutTypes)[keyof typeof calloutTypes];

const icons: Record<CalloutKind, ComponentType<{ className?: string }>> = {
  note: Info,
  info: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
  danger: OctagonAlert,
};

/**
 * A tight, icon-led callout. The old Fumadocs callout reserved a full title
 * row even when there was no title, which made every notice feel oversized.
 * Here the icon carries the type and the title is only rendered when content
 * supplies one.
 */
export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: keyof typeof calloutTypes;
  title?: string;
  children: ReactNode;
}) {
  const kind = calloutTypes[type] ?? "note";
  const Icon = icons[kind];

  return (
    <div className={`sp-callout sp-callout--${kind}`}>
      <span aria-hidden className="sp-callout__icon">
        <Icon />
      </span>
      <div className="sp-callout__body">
        {title ? <div className="sp-callout__title">{title}</div> : null}
        <div className="sp-callout__content">{children}</div>
      </div>
    </div>
  );
}

export default Callout;
