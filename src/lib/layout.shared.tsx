import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared";
import { SpectaLogoWithRightClickForBrand } from "@/components/LogoWithRightClickForBrand";
import { DiscordLogo } from "@/components/logos";

export const homeLinks: LinkItemType[] = [
  {
    type: "main",
    text: "Docs",
    url: "/docs",
    external: false,
    on: "nav",
  },
];

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <SpectaLogoWithRightClickForBrand />,
    },
    githubUrl: "https://github.com/specta",
    links: [
      {
        type: "icon",
        icon: <DiscordLogo />,
        text: "Discord",
        url: "https://discord.com/invite/JgqH8b4ycw",
        secondary: true,
      },
    ],
  };
}
