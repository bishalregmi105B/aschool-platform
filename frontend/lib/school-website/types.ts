/**
 * School Website Widget Type System
 * School website visual editor type system.
 */

export type ControlType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "color"
  | "image"
  | "toggle"
  | "select"
  | "items"
  | "slides"
  | "stats";

export type ControlGroup = "content" | "style" | "advanced";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SchoolWidgetControl {
  key: string;
  label: string;
  type: ControlType;
  group?: ControlGroup;
  placeholder?: string;
  hint?: string;
  options?: SelectOption[];
}

export type WidgetCategory = "hero" | "content" | "academic" | "layout" | "cta";

export interface SchoolWidgetDef {
  type: string;
  name: string;
  icon: string;
  description: string;
  category: WidgetCategory;
  defaultContent: Record<string, unknown>;
  controls: SchoolWidgetControl[];
  /** CSS preview gradient for the section card thumbnail */
  previewGradient?: string;
}

export interface SchoolSection {
  id: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  sort_order: number;
}

export type ColorScheme = {
  primary: string;
  secondary: string;
  accent: string;
  bg?: string;
  surface?: string;
  text?: string;
};

export interface SchoolTemplate {
  id: string;
  name: string;
  description: string;
  /** Emoji or text thumbnail */
  emoji: string;
  category: "classic" | "modern" | "traditional";
  tags: string[];
  colorScheme: ColorScheme;
  sections: Omit<SchoolSection, "id">[];
}
