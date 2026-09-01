/** Public Results Page — builder sections first, results checker as fallback. */
import { getBuilderPage, hasBuilderSections, BuilderPageSections } from "@/lib/builder-page";
import { ResultsChecker } from "./ResultsChecker";

export default async function ResultsPage({ params }: { params: { slug: string } }) {
  // ── Builder-designed Results page → same rendering as builder preview ────
  const builder = await getBuilderPage(params.slug, "results");
  if (hasBuilderSections(builder)) {
    return <BuilderPageSections slug={params.slug} data={builder!} />;
  }

  // ── Fallback: classic interactive results checker ─────────────────────────
  return <ResultsChecker slug={params.slug} />;
}
