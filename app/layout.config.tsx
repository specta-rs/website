import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { SiteLogo } from "./(home)/SiteLogo";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <SiteLogo className="-my-[6px] mx-1" />,
  },
};
