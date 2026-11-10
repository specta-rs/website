import { useFrontmatter } from "@rspress/core/runtime";
import { getCustomMDXComponent } from "@rspress/core/theme-original";

const DefaultPre = getCustomMDXComponent().pre;

/**
 * Generated reference pages can contain hundreds of symbol signatures. They
 * are highlighted like every other code sample, but skip Rspress's per-block
 * copy/wrap toolbar: the toolbar would cover the first line on narrow screens
 * and add a lot of markup to every signature.
 */
export function SignaturePre(props: any) {
  const { frontmatter } = useFrontmatter();

  if (!frontmatter.generated) {
    return <DefaultPre {...props} />;
  }

  return (
    <pre className="sp-signature-pre" data-lang="ts">
      {props.children}
    </pre>
  );
}
