import {
  Layout as OriginalLayout,
  type LayoutProps,
} from "@rspress/core/theme-original";
import { Analytics } from "./analytics";
import { DocsHeader } from "./docs-header";
import { NotFoundLayout } from "./not-found";
import { ProjectSwitcher } from "./project-switcher";
import { SiteHead } from "./site-head";
import { SpectaLogo } from "./logo";
import { SymbolHeading } from "./symbol-heading";

export function Layout(props: LayoutProps) {
  return (
    <>
      <Analytics />
      <OriginalLayout
        {...props}
        top={<SiteHead />}
        navTitle={<SpectaLogo />}
        beforeSidebar={<ProjectSwitcher />}
        beforeDocContent={<DocsHeader />}
        components={{ h3: SymbolHeading }}
        NotFoundLayout={NotFoundLayout}
      />
    </>
  );
}
