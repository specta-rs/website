import { useFrontmatter } from "@rspress/core/runtime";
import { EditLink as OriginalEditLink } from "@rspress/core/theme-original";

/**
 * Generated reference pages have no committed source file, so they must not
 * offer an edit link that would 404 on GitHub.
 */
export function EditLink({ isOutline }: { isOutline?: boolean }) {
  const { frontmatter } = useFrontmatter();
  if (frontmatter.generated) return null;
  return <OriginalEditLink isOutline={isOutline} />;
}
