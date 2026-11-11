import { gurafiAppIcon } from "./gurafi-icon";

export const projects = [
  {
    id: "specta",
    name: "Specta",
    description: "Export your Rust types to any language",
    icon: "/assets/specta.png",
    className: "h-5 w-[30px]",
  },
  {
    id: "rspc",
    name: "rspc",
    description: "A framework for building typesafe web backends in Rust",
    icon: "/assets/rspc.png",
    className: "h-5 w-[20px]",
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
    className: "h-6 w-6",
  },
];
