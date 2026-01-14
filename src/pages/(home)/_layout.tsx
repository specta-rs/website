import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { Meta } from "@/components/Meta";
import { baseOptions, homeLinks } from "@/lib/layout.shared";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions()} links={homeLinks}>
      <Meta />

      {children}
    </HomeLayout>
  );
}
