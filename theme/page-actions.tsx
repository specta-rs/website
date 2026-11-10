"use client";

import {
  Bot,
  Check,
  ChevronDown,
  Code2,
  Copy,
  ExternalLink,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

function askUrl(base: string, params: Record<string, string>) {
  return `${base}?${new URLSearchParams(params)}`;
}

export function CopyMarkdownButton({ markdownUrl }: { markdownUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      className="sp-action-button"
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
              icon: <Code2 />,
            },
          ]
        : []),
      {
        title: "Open in Scira AI",
        href: askUrl("https://scira.ai/", { q: query }),
        icon: <Sparkles />,
      },
      {
        title: "Open in ChatGPT",
        href: askUrl("https://chatgpt.com/", {
          hints: "search",
          q: query,
        }),
        icon: <Bot />,
      },
      {
        title: "Open in Claude",
        href: askUrl("https://claude.ai/new", { q: query }),
        icon: <MessageCircle />,
      },
      {
        title: "Open in T3 Chat",
        href: askUrl("https://t3.chat/new", { q: query }),
        icon: <MessageCircle />,
      },
    ];
  }, [githubUrl, markdownUrl]);

  return (
    <details className="sp-action-menu group">
      <summary className="sp-action-button sp-action-button--menu">
        Open
        <ChevronDown className="sp-action-button__chevron" />
      </summary>
      <div className="sp-action-menu__panel">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            rel="noreferrer noopener"
            target="_blank"
            className="sp-action-menu__item"
          >
            {item.icon}
            <span className="sp-action-menu__label">{item.title}</span>
            <ExternalLink className="sp-action-menu__external" />
          </a>
        ))}
      </div>
    </details>
  );
}
