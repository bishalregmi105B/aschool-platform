const PLUGIN_SEARCH_ALIASES: Record<string, string> = {
  communications: "sms_notifications",
  hr: "hr_payroll",
  transport: "gps_tracking",
  visitors: "visitor_management",
  library: "library_management",
  digital_content: "elibrary",
  design_studio: "digital_content",
};

type SearchableMarketplacePlugin = {
  slug: string;
  name: string;
  description?: string;
};

function normalizeTextTerm(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeSlugTerm(value: string): string {
  return normalizeTextTerm(value).replace(/[\s-]+/g, "_");
}

function getAliasFamily(slug: string): Set<string> {
  const normalizedSlug = normalizeSlugTerm(slug);
  const aliases = new Set<string>();
  if (!normalizedSlug) return aliases;

  aliases.add(normalizedSlug);
  const frontier = [normalizedSlug];

  while (frontier.length) {
    const current = frontier.pop() as string;
    const mapped = PLUGIN_SEARCH_ALIASES[current];
    if (mapped && !aliases.has(mapped)) {
      aliases.add(mapped);
      frontier.push(mapped);
    }

    Object.entries(PLUGIN_SEARCH_ALIASES).forEach(([from, to]) => {
      if (to === current && !aliases.has(from)) {
        aliases.add(from);
        frontier.push(from);
      }
    });
  }

  return aliases;
}

export function matchesMarketplacePluginSearch(
  plugin: SearchableMarketplacePlugin,
  rawSearch: string,
): boolean {
  const textSearch = normalizeTextTerm(rawSearch);
  if (!textSearch) return true;

  const pluginAliases = getAliasFamily(plugin.slug);
  const queryAliases = getAliasFamily(rawSearch);

  const searchableTerms = [
    plugin.name,
    plugin.description,
    plugin.slug,
    plugin.slug.replace(/_/g, " "),
    ...Array.from(pluginAliases),
    ...Array.from(pluginAliases).map((alias) => alias.replace(/_/g, " ")),
  ]
    .filter((term): term is string => Boolean(term))
    .map((term) => normalizeTextTerm(term));

  if (searchableTerms.some((term) => term.includes(textSearch))) {
    return true;
  }

  return Array.from(pluginAliases).some((alias) => queryAliases.has(alias));
}