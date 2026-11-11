import { Check, ChevronDown } from "lucide-react";
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
      className={cn("max-h-full max-w-full object-contain", className)}
    />
  );
}

/**
 * The value shown when the reader is on a docs page that does not belong to a
 * project, such as the `/docs` ecosystem overview.
 */
const ecosystem = {
  id: "ecosystem",
  name: "specta-rs",
  description: "Rust crates for better web apps",
  icon: "/assets/specta.png",
  className: "h-5 w-[30px]",
} satisfies (typeof projects)[number];

/**
 * A small project switcher at the top of the documentation sidebar. The old
 * site used Fumadocs' root toggle; Rspress has no equivalent, so this keeps
 * the same "Specta / rspc / Tauri Specta" navigation.
 *
 * The switcher stays visible on the docs overview too. The sidebar itself is
 * shared by every docs page (the active project expands in place), so keeping
 * this header permanent means navigating between projects never swaps out the
 * whole sidebar chrome.
 */
export function ProjectSwitcher() {
  const { pathname } = useLocation();
  const current = projects.find((project) =>
    pathname.startsWith(`/docs/${project.id}`),
  );
  const display = current ?? ecosystem;

  return (
    <div className="mb-4 px-0.5 pt-1">
      <p className="mb-2 px-1 font-mono text-[10px] font-medium tracking-[0.12em] text-fd-muted-foreground/80 uppercase">
        Project
      </p>
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl border border-sp-line bg-sp-panel px-2.5 py-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors hover:border-sp-accent-line hover:bg-sp-panel-hover [&::-webkit-details-marker]:hidden">
          <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg border border-sp-line bg-sp-panel-strong">
            <ProjectIcon project={display} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold tracking-[-0.01em]">
              {display.name}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] leading-4 text-fd-muted-foreground">
              {display.description}
            </span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-fd-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="sp-project-switcher__panel absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-sp-line bg-fd-popover p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.45)]">
          <a
            href="/docs"
            aria-current={current ? undefined : "page"}
            className={cn(
              "flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-fd-accent",
              !current && "bg-sp-accent-soft",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-8 w-12 shrink-0 items-center justify-center rounded-md border bg-sp-panel",
                !current ? "border-sp-accent-line" : "border-sp-line",
              )}
            >
              <ProjectIcon project={ecosystem} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">
                {ecosystem.name}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-fd-muted-foreground">
                {ecosystem.description}
              </span>
            </span>
            {current ? null : (
              <Check className="mt-1 size-3.5 shrink-0 text-sp-accent" />
            )}
          </a>

          <div className="mt-1.5 border-t border-sp-line pt-1.5">
            {projects.map((project) => {
              const active = project.id === current?.id;
              return (
                <a
                  key={project.id}
                  href={`/docs/${project.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-fd-accent",
                    active && "bg-sp-accent-soft",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-12 shrink-0 items-center justify-center rounded-md border",
                      active
                        ? "border-sp-accent-line bg-sp-panel"
                        : "border-sp-line bg-sp-panel",
                    )}
                  >
                    <ProjectIcon project={project} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">
                      {project.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-fd-muted-foreground">
                      {project.description}
                    </span>
                  </span>
                  {active ? (
                    <Check className="mt-1 size-3.5 shrink-0 text-sp-accent" />
                  ) : null}
                </a>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
