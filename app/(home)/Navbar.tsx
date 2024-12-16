import { ThemeToggle } from "fumadocs-ui/components/layout/theme-toggle";
import { SiteLogo } from "./SiteLogo";
import Link from "next/link";

export function Navbar() {
  return (
    <>
      <div className="backdrop-blur-sm w-full h-16 px-4 flex items-center justify-between fixed top-0">
        <Link href="/">
          <SiteLogo />
        </Link>

        <div className="flex items-center space-x-4">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
