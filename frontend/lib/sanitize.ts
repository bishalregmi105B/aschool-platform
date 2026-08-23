import DOMPurify from "isomorphic-dompurify";

/**
 * Allowlist-based HTML sanitizer for school-controlled rich text
 * (notice bodies, website sections, exam question markup, AI-generated HTML).
 *
 * Strips scripts, event handlers, javascript: URLs and other active content
 * before anything is rendered via dangerouslySetInnerHTML.
 */
const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const ALLOWED_ATTR = [
  "alt",
  "class",
  "colspan",
  "height",
  "href",
  "name",
  "rowspan",
  "src",
  "srcset",
  "style",
  "target",
  "title",
  "width",
];

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ["onerror", "onload", "onclick"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Allowlist-based CSS sanitizer for tenant custom_css rendered into the
 * public site's <style> block. Mirrors the backend sanitize_custom_css():
 * only plain selector{declaration} blocks survive — no url()/expression(),
 * no @import, no <, no backslashes (blocks </style><script> escape and
 * IE expression() vectors). Backend sanitizes on write; this defends
 * in depth against rows written before that fix.
 */
const _CSS_URL_RE = /url\s*\(/i;
const _CSS_DANGER_RE = /(javascript\s*:|expression\s*\(|@import|behavior\s*:|<|\\)/i;
const _CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const _CSS_SAFE_SELECTOR_RE = /^[A-Za-z0-9_\-\s.#>,:*[\]="'()+%~|^$]*$/;
const _CSS_SAFE_DECL_RE = /^[-a-zA-Z]+\s*:\s*[^;{}]*$/i;

export function sanitizeCss(css: string | null | undefined): string {
  if (!css) return "";
  const cleaned = css.replace(_CSS_COMMENT_RE, "");
  const safeBlocks: string[] = [];
  for (const match of cleaned.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const body = match[2];
    if (!selector || !_CSS_SAFE_SELECTOR_RE.test(selector)) continue;
    if (_CSS_URL_RE.test(body) || _CSS_DANGER_RE.test(body)) continue;
    const decls = body
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d && _CSS_SAFE_DECL_RE.test(d));
    if (decls.length) safeBlocks.push(`${selector} { ${decls.join("; ")}; }`);
  }
  return safeBlocks.join("\n");
}
