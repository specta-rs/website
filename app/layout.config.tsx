import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { SiteLogo } from "./(home)/SiteLogo";
import { Banner } from "fumadocs-ui/components/banner";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <SiteLogo className="-my-[6px] mx-1" />,
    // TODO: Remove this once the docs are more stable.
    component: (
      <Banner>
        <b className="mr-1">WARNING:</b> These docs are a work in progress! Some
        sections are incomplete or incorrect.
      </Banner>
    ),
  },
};
