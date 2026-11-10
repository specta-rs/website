import { useFrontmatter } from "@rspress/core/runtime";
import { getCustomMDXComponent } from "@rspress/core/theme-original";
import { Children, isValidElement, type ComponentProps } from "react";

const DefaultH3 = getCustomMDXComponent().h3;

/**
 * A symbol heading is one of hundreds on a generated reference page, so it
 * renders without the anchor-link icon the guide headings carry. The heading
 * id still comes from the MDX pipeline, so anchors and search deep links keep
 * working.
 */
export function SymbolHeading({ children, ...props }: ComponentProps<"h3">) {
  const { frontmatter } = useFrontmatter();

  if (!frontmatter.generated) {
    return <DefaultH3 {...props}>{children}</DefaultH3>;
  }

  const withoutAnchor = Children.toArray(children).filter((child) => {
    if (!isValidElement(child)) return true;
    const { className } = child.props as { className?: string };
    return (
      typeof className !== "string" || !className.includes("rp-header-anchor")
    );
  });

  return (
    <h3 {...props} className="mt-6 scroll-mt-24 text-base font-semibold">
      {withoutAnchor}
    </h3>
  );
}
