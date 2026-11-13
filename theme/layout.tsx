import {
  Layout as OriginalLayout,
  type LayoutProps,
} from "@rspress/core/theme-original";
import { AccessibilityFixes } from "./a11y";
import { Analytics } from "./analytics";
import { Diagrams } from "./diagrams";
import { DocsHeader } from "./docs-header";
import { DrawerClose } from "./drawer-close";
import { NotFoundLayout } from "./not-found";
import { ProjectSwitcher } from "./project-switcher";
import { SignaturePre } from "./signature-pre";
import { SiteHead } from "./site-head";
import { SpectaLogo } from "./logo";
import { SymbolHeading } from "./symbol-heading";

export function Layout(props: LayoutProps) {
  return (
    <>
      <Analytics />
      <AccessibilityFixes />
      <Diagrams />
      <OriginalLayout
        {...props}
        top={<SiteHead />}
        navTitle={<SpectaLogo />}
        beforeSidebar={
          <>
            <DrawerClose />
            <ProjectSwitcher />
          </>
        }
        beforeDocContent={<DocsHeader />}
        components={{ h3: SymbolHeading, pre: SignaturePre }}
        NotFoundLayout={NotFoundLayout}
      />
    </>
  );
}
