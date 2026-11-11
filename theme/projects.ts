import { gurafiAppIcon } from "./gurafi-icon";

export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  className: string;
  /**
   * Overrides the icon frame in the project picker. The picker reserves a
   * fixed column for the frame, so a wider frame here does not move the text.
   */
  frameClassName?: string;
  deprecated?: boolean;
};

export const projects: Project[] = [
  {
    id: "specta",
    name: "Specta",
    description: "Export your Rust types to any language",
    icon: "/assets/specta.png",
    className: "h-5 w-[30px]",
  },
  {
    id: "tauri-specta",
    name: "Tauri Specta",
    description: "Completely typesafe Tauri commands",
    icon: "/assets/tauri-specta.png",
    className: "h-6 w-[56px]",
    frameClassName: "w-[72px]",
  },
  {
    id: "gurafi",
    name: "Gurafi",
    description: "A type-safe, code-first GraphQL stack for Rust",
    icon: gurafiAppIcon,
    className: "h-[38px] w-[38px]",
    frameClassName: "w-10",
  },
  {
    id: "fsk",
    name: "FSK",
    description: "Build cross-platform virtual file systems in Rust",
    icon: "/assets/fsk-app-icon.svg",
    // The FSK asset carries ~10% transparent padding around its tile, so it is
    // scaled up (overriding the preflight `max-width`) until the tile reaches
    // the frame edges.
    className: "h-12 w-12 max-w-none shrink-0",
    frameClassName: "w-10",
  },
  {
    id: "rspc",
    name: "rspc",
    description: "A framework for building typesafe web backends in Rust",
    icon: "/assets/rspc.png",
    className: "h-6 w-6",
    frameClassName: "w-10",
    deprecated: true,
  },
];
