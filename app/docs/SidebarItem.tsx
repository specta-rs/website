"use client";

import { CratesIoLogo, NpmLogo } from "@/lib/logos";
import { type SidebarComponents } from "fumadocs-ui/layouts/docs/shared";
import { SidebarItem } from "fumadocs-ui/layouts/docs/sidebar";

export const components: Partial<SidebarComponents> = {
  Item: ({ item }) => {
    // TODO: generalise this and configure it for all revelant links
    if (item.url === "/docs/rspc/client/vanilla") {
      return (
        <div className="flex w-full">
          <SidebarItem
            key={item.url}
            href={item.url}
            external={item.external}
            icon={item.icon}
            className="w-full"
          >
            {item.name}
          </SidebarItem>
          <SidebarItem
            key={item.url + "-npm"}
            href="https://www.npmjs.com/package/@rspc/client"
            external={item.external}
            className="ml-1"
          >
            <NpmLogo />
          </SidebarItem>
        </div>
      );
    } else if (item.url === "/docs/rspc/client/rust") {
      return (
        <div className="flex w-full">
          <SidebarItem
            key={item.url}
            href={item.url}
            external={item.external}
            icon={item.icon}
            className="w-full"
          >
            {item.name}
          </SidebarItem>
          <SidebarItem
            key={item.url + "-npm"}
            href="https://docs.rs/rspc"
            external={item.external}
            className="ml-1"
          >
            <CratesIoLogo />
          </SidebarItem>
        </div>
      );
    }

    return (
      <SidebarItem
        key={item.url}
        href={item.url}
        external={item.external}
        icon={item.icon}
      >
        {item.name}
      </SidebarItem>
    );
  },
};
