"use client";

import { useRouter } from "next/navigation";

export function SiteLogo(props: { className?: string }) {
  const router = useRouter();

  return (
    <h1
      className={"font-bold text-3xl " + props.className}
      onContextMenu={(e) => {
        e.preventDefault();
        router.push("/docs/brand");
      }}
    >
      specta-rs
    </h1>
  );
}
