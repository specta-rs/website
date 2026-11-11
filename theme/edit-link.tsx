import { useFrontmatter, useI18n } from "@rspress/core/runtime";
import { EditLink as OriginalEditLink } from "@rspress/core/theme-original";

/**
 * Generated reference pages have no committed source file, so they must not
 * offer an edit link that would 404 on GitHub. Synced project docs carry an
 * `editUrl` pointing at their source repository instead of the website copy.
 */
export function EditLink({ isOutline }: { isOutline?: boolean }) {
  const { frontmatter } = useFrontmatter();
  const t = useI18n();
  if (frontmatter.generated) return null;

  const editUrl = (frontmatter as { editUrl?: string }).editUrl;
  if (editUrl) {
    return (
      <a
        href={editUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={
          isOutline
            ? "rp-outline__action-row rp-edit-link"
            : "rp-edit-link rp-link"
        }
      >
        {t("editLinkText")}
      </a>
    );
  }

  return <OriginalEditLink isOutline={isOutline} />;
}
