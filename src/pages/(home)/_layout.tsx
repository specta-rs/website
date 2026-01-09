import type { ReactNode } from "react";
import { baseOptions, homeLinks } from "@/lib/layout.shared";
import { HomeLayout } from "fumadocs-ui/layouts/home";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions()} links={homeLinks}>
      {children}
    </HomeLayout>
  );
}
