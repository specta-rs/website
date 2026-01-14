import type { PropsWithChildren } from "react";

export default async function RootElement({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>specta-rs</title>
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
