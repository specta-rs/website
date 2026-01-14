import type { ReactNode } from "react";
import { baseOptions, homeLinks } from "@/lib/layout.shared";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Meta } from "@/components/Meta";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions()} links={homeLinks}>
      <Meta />

      {children}
    </HomeLayout>
  );
}
