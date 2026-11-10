import { useHead } from "@rspress/core/runtime";
import { ArrowRight, Home } from "lucide-react";

export function NotFoundLayout() {
  useHead({
    title: "Not Found",
    meta: [
      {
        name: "description",
        content: "The page your looking for doesn't exist",
      },
    ],
  });

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            <span className="bg-linear-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              404
            </span>
          </h1>

          <p className="text-lg text-fd-muted-foreground md:text-xl">
            The page your looking for doesn&apos;t exist
          </p>

          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-fd-primary px-6 py-3 text-base font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/80"
          >
            <Home className="h-4 w-4" />
            Back to Home
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
