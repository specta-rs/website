import "@/styles/globals.css";
import type { ReactNode } from "react";
import { Provider } from "@/components/provider";
import "../lib/posthog";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}
