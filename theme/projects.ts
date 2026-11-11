import { gurafiAppIcon } from "./gurafi-icon";

export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  className: string;
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
    className: "h-5 w-[44px]",
  },
  {
    id: "gurafi",
    name: "Gurafi",
    description: "A type-safe, code-first GraphQL stack for Rust",
    icon: gurafiAppIcon,
    className: "h-8 w-8",
  },
  {
    id: "fsk",
    name: "FSK",
    description: "Build cross-platform virtual file systems in Rust",
    icon: "/assets/fsk-app-icon.svg",
    className: "h-8 w-8",
  },
  {
    id: "rspc",
    name: "rspc",
    description: "A framework for building typesafe web backends in Rust",
    icon: "/assets/rspc.png",
    className: "h-6 w-6",
    deprecated: true,
  },
];
