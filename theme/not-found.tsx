import { useHead } from "@rspress/core/runtime";
import { ArrowRight, Home } from "lucide-react";

const description = "The page your looking for doesn't exist";

export function NotFoundLayout() {
  useHead({
    title: "Not Found",
    meta: [{ name: "description", content: description }],
  });

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <h1 className="text-5xl font-bold tracking-[-0.04em] text-sp-accent md:text-6xl lg:text-7xl">
          404
        </h1>

        <p className="text-[15px] text-fd-muted-foreground md:text-lg">
          {description}
        </p>

        <a
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-sp-cta px-6 py-3 text-sm font-semibold text-sp-cta-foreground shadow-[0_10px_30px_-12px_var(--sp-accent-glow)] transition-colors hover:bg-sp-cta-hover"
        >
          <Home className="size-4" />
          Back to Home
          <ArrowRight className="size-4" />
        </a>
      </div>
    </div>
  );
}
