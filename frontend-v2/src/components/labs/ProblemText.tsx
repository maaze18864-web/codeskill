"use client";

import { createElement, useEffect, useState, type ReactNode } from "react";

const tags = new Set([
  "p",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "br",
  "hr",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sub",
  "sup",
]);
const blocked = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "template",
]);

// Render authored formatting as React nodes. No HTML attributes, scripts, or
// event handlers from the stored statement are inserted into the page.
function formattedNodes(html: string): ReactNode[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const render = (node: Node, key: string): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = (node as Element).tagName.toLowerCase();
    if (blocked.has(tag)) return null;
    const children = Array.from(node.childNodes, (child, i) =>
      render(child, `${key}-${i}`),
    );
    return tags.has(tag)
      ? createElement(
          tag,
          { key },
          tag === "br" || tag === "hr" ? undefined : children,
        )
      : children;
  };
  return Array.from(document.body.childNodes, (node, i) =>
    render(node, String(i)),
  );
}

export function ProblemText({ content }: { content: string }) {
  const [formatted, setFormatted] = useState<{
    source: string;
    nodes: ReactNode[];
  } | null>(null);
  useEffect(() => {
    setFormatted({ source: content, nodes: formattedNodes(content) });
  }, [content]);

  return (
    <div className="break-words text-sm leading-7 text-foreground/90 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2">
      {formatted?.source === content ? (
        formatted.nodes
      ) : (
        <p className="whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}
