"use client";

import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border bg-fd-secondary px-2 py-1.5 text-xs font-medium text-fd-secondary-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground";

export function CopyMarkdownButton({ markdownUrl }: { markdownUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      className={buttonClass}
      onClick={async () => {
        setLoading(true);
        try {
          const markdown = await fetch(markdownUrl).then((response) =>
            response.text(),
          );
          await navigator.clipboard.writeText(markdown);
          setChecked(true);
          window.setTimeout(() => setChecked(false), 2000);
        } finally {
          setLoading(false);
        }
      }}
    >
      {checked ? <Check /> : <Copy />}
      {checked ? "Copied" : "Copy Markdown"}
    </button>
  );
}

export function ViewOptions({
  markdownUrl,
  githubUrl,
}: {
  markdownUrl: string;
  githubUrl?: string;
}) {
  const items = useMemo(() => {
    const fullMarkdownUrl =
      typeof window !== "undefined"
        ? new URL(markdownUrl, window.location.origin).toString()
        : markdownUrl;
    const query = `Read ${fullMarkdownUrl}, I want to ask questions about it.`;

    return [
      ...(githubUrl
        ? [
            {
              title: "Open in GitHub",
              href: githubUrl,
              icon: <ExternalLink />,
            },
          ]
        : []),
      {
        title: "Open in Scira AI",
        href: `https://scira.ai/?${new URLSearchParams({ q: query })}`,
        icon: <MessageCircle />,
      },
      {
        title: "Open in ChatGPT",
        href: `https://chatgpt.com/?${new URLSearchParams({
          hints: "search",
          q: query,
        })}`,
        icon: <MessageCircle />,
      },
      {
        title: "Open in Claude",
        href: `https://claude.ai/new?${new URLSearchParams({ q: query })}`,
        icon: <MessageCircle />,
      },
      {
        title: "Open in T3 Chat",
        href: `https://t3.chat/new?${new URLSearchParams({ q: query })}`,
        icon: <MessageCircle />,
      },
    ];
  }, [githubUrl, markdownUrl]);

  return (
    <details className="group relative">
      <summary
        className={cn(
          buttonClass,
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        Open
        <ChevronDown className="size-3.5 text-fd-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 z-30 mt-1 flex w-56 flex-col rounded-lg border bg-fd-popover p-1 shadow-lg">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            rel="noreferrer noopener"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4"
          >
            {item.icon}
            {item.title}
            <ExternalLink className="ms-auto size-3.5 text-fd-muted-foreground" />
          </a>
        ))}
      </div>
    </details>
  );
}
