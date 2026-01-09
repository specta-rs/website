import { Home, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { Link } from "waku";

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex min-h-screen items-center justify-center">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-linear-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                404
              </span>
            </h1>

            <p className="text-lg md:text-xl text-fd-muted-foreground">
              This page doesn't exist
            </p>

            <Link
              to="/"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "gap-2 px-6 py-3 text-base",
              )}
            >
              <Home className="w-4 h-4" />
              Back to Home
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
}
