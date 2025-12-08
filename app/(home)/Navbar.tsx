"use client";

import { SiteLogo } from "./SiteLogo";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="backdrop-blur-sm w-full h-16 px-4 flex items-center justify-between fixed top-0">
        <Link href="/">
          <SiteLogo />
        </Link>

        <div className="flex items-center space-x-4">
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {theme === "dark" ? "🌞" : "🌙"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
