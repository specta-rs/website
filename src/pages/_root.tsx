import type { PropsWithChildren } from "react";
import { StaticMeta } from "@/components/Meta";

export default async function RootElement({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <StaticMeta />
      </head>
      <body className="flex flex-col min-h-screen">{children}</body>
    </html>
  );
}

export async function getConfig() {
  return {
    render: "static",
  } as const;
}
