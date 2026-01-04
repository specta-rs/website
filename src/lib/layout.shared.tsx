import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared";
import { SpectaLogoWithRightClickForBrand } from "@/components/LogoWithRightClickForBrand";
import { DiscordLogo } from "@/components/logos";

const baseLinks: LinkItemType[] = [
  {
    type: "icon",
    icon: (
      <DiscordLogo className="brightness-0 dark:invert hover:brightness-100 dark:hover:invert-0 transition-colors duration-300 ease-in-out" />
    ),
    text: "Discord",
    url: "https://discord.com/invite/JgqH8b4ycw",
    secondary: true,
  },
];

export const homeLinks: LinkItemType[] = [
  {
    type: "main",
    text: "Docs",
    url: "/docs",
    external: false,
  },
  ...baseLinks,
];

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <SpectaLogoWithRightClickForBrand />,
    },
    githubUrl: "https://github.com/specta-rs",
    links: baseLinks,
  };
}
