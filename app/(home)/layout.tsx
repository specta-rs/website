import { ReactNode } from "react";
import { Navbar } from "./Navbar";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16 h-full w-full">{children}</div>
    </>
  );
}
