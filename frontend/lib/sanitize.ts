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
