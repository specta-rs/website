import { ChevronDown } from "lucide-react";
import { useLocation } from "@rspress/core/runtime";
import { cn } from "@/lib/utils";
import { projects } from "./projects";

function ProjectIcon({
  project,
  className,
}: {
  project: (typeof projects)[number];
  className?: string;
}) {
  return (
    <img
      src={project.icon}
      alt={`${project.name} logo`}
      className={cn(project.className, "max-w-none object-contain", className)}
    />
  );
}

/**
 * A small project switcher at the top of the documentation sidebar. The old
 * site used Fumadocs' root toggle; Rspress has no equivalent, so this keeps
 * the same "Specta / rspc / Tauri Specta" navigation.
 */
export function ProjectSwitcher() {
  const { pathname } = useLocation();
  const current = projects.find((project) =>
    pathname.startsWith(`/docs/${project.id}`),
  );
  if (!current) return null;

  return (
    <div className="mb-2 px-3 pt-3">
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg border bg-fd-secondary/50 px-3 py-2 transition-colors hover:bg-fd-accent [&::-webkit-details-marker]:hidden">
          <ProjectIcon project={current} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {current.name}
            </span>
            <span className="block truncate text-xs text-fd-muted-foreground">
              {current.description}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-fd-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-fd-popover p-1 shadow-lg">
          {projects.map((project) => (
            <a
              key={project.id}
              href={`/docs/${project.id}`}
              className={`flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-fd-accent ${
                project.id === current.id ? "bg-fd-accent" : ""
              }`}
            >
              <ProjectIcon project={project} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {project.name}
                </span>
                <span className="block text-xs text-fd-muted-foreground">
                  {project.description}
                </span>
              </span>
            </a>
          ))}
        </div>
      </details>
    </div>
  );
}
