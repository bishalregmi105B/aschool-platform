"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/**
 * AiResultView — the ONE renderer for AI tool output (D-4).
 *
 * The ai-tools pages used to print results as `whitespace-pre-wrap` plain
 * text: no markdown, no KaTeX, no export. This component renders the two
 * shapes the workbench actually produces:
 *
 *  1. structured results (doc_sections / lesson_plan / worksheet / …) —
 *     headings + lists, with `$…$` / `$$…$$` math through KaTeX;
 *  2. raw markdown strings (legacy tools, tutor replies).
 *
 * Devanagari renders through the app font stack; KaTeX handles the math.
 */

export type DocSectionsResult = {
  title?: string;
  sections?: { heading?: string; body?: string[] }[];
  follow_ups?: string[];
};

function isDocSections(value: unknown): value is DocSectionsResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.sections) ||
    (typeof v.title === "string" && Array.isArray(v.sections))
  );
}

export function AiResultView({ result }: { result: unknown }) {
  if (isDocSections(result)) {
    return <DocSectionsView result={result} />;
  }
  if (typeof result === "string") {
    return <MarkdownView text={result} />;
  }
  return (
    <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

function DocSectionsView({ result }: { result: DocSectionsResult }) {
  return (
    <div className="space-y-4">
      {result.title && (
        <h3 className="text-base font-semibold">{result.title}</h3>
      )}
      {(result.sections || []).map((section, i) => (
        <div key={i} className="space-y-1">
          {section.heading && (
            <h4 className="text-sm font-semibold">{section.heading}</h4>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(section.body || []).map((line, j) => (
              <li key={j} className="leading-relaxed">
                <MarkdownInline text={line} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {(result.follow_ups || []).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {result.follow_ups!.map((chip, i) => (
            <span
              key={i}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Markdown string → styled output with KaTeX for $…$ and $$…$$ blocks. */
export function MarkdownView({ text }: { text: string }) {
  return (
    <div className="ai-result-prose space-y-2 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        components={{
          h1: (p) => <h2 className="text-lg font-semibold" {...p} />,
          h2: (p) => <h3 className="text-base font-semibold" {...p} />,
          h3: (p) => <h4 className="text-sm font-semibold" {...p} />,
          table: (p) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          th: (p) => <th className="border px-2 py-1 text-left" {...p} />,
          td: (p) => <td className="border px-2 py-1" {...p} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** One line of text with inline $…$ math — for list items. */
export function MarkdownInline({ text }: { text: string }) {
  if (!text.includes("$")) return <>{text}</>;
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const html = katex.renderToString(part.slice(1, -1), {
            throwOnError: false,
            output: "html",
          });
          return (
            <span
              key={i}
              // katex html is generated locally from the model's math snippet
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
