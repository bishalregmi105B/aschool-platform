import { matchesMarketplacePluginSearch } from "@/lib/marketplace-search";

describe("matchesMarketplacePluginSearch", () => {
  const elibraryPlugin = {
    slug: "elibrary",
    name: "E-Library & Digital Content",
    description: "Digital books, past papers, educational resources",
  };

  it("matches direct alias searches for elibrary", () => {
    expect(matchesMarketplacePluginSearch(elibraryPlugin, "digital_content")).toBe(true);
  });

  it("matches chained alias searches for design studio redirects", () => {
    expect(matchesMarketplacePluginSearch(elibraryPlugin, "design_studio")).toBe(true);
  });

  it("matches space-separated search terms against plugin aliases", () => {
    expect(matchesMarketplacePluginSearch(elibraryPlugin, "digital content")).toBe(true);
  });

  it("does not match unrelated searches", () => {
    expect(matchesMarketplacePluginSearch(elibraryPlugin, "transport management")).toBe(false);
  });
});