"use client";

import { PluginGate } from "@/lib/plugins";
import { AOSPage, AOSPageHeader, AOSPageBody } from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { FileSpreadsheet } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * IEMIS Excel Sync — merged entry point (DUPLICATION_MATRIX §4, plan 34-49:
 * "iemis (→ compliance)").
 *
 * This page used to duplicate the IEMIS importer with a response contract the
 * API never returns (`total_processed`/`successful`/`failed` — the real keys
 * are `imported_rows`/`error_rows`). The route is kept for old deep links,
 * but it now simply points at the single canonical 3-step importer instead
 * of running a second, broken upload form.
 */
export default function IemisUploadPage() {
  const { t } = useI18n();
  return (
    <PluginGate slug="iemis_importer">
      <AOSPage>
        <AOSPageHeader
          icon={<FileSpreadsheet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("IEMIS Excel Sync", "IEMIS Excel सिंक")}
          subtitle={t(
            "This importer now lives in the IEMIS Import app — one validated wizard for all government reports",
            "यो आयातकर्ती अब IEMIS आयात एपमा छ — सरकारी प्रतिवेदनका लागि एउटा जाँचिएको विजार्ड"
          )}
        />
        <AOSPageBody>
          <div className="win11-infobar info mb-4" style={{ padding: "10px 12px" }}>
            {t(
              "The old quick-upload form was removed: it displayed result fields the API does not return. Use the wizard below, which validates every row on the server before writing anything.",
              "पुरानो छिटो-अपलोड फारम हटाइएको छ: यसले API ले नदिने नतिजा-fieldहरू देखाउँथ्यो। तलको विजार्ड प्रयोग गर्नुहोस् जसले लेख्नुअघि प्रत्येक पङ्क्ति जाँच्छ।"
            )}
          </div>
          <QuickLinks
            section="Operations"
            links={[
              { label: t("IEMIS Import Wizard", "IEMIS आयात विजार्ड"), icon: "FileSpreadsheet", href: "/dashboard/iemis-import" },
              { label: t("Import History", "आयात इतिहास"), icon: "History", href: "/dashboard/iemis-import/history" },
              { label: t("Compliance & EMIS", "अनुपालन र EMIS"), icon: "ShieldCheck", href: "/dashboard/compliance" },
            ]}
          />
        </AOSPageBody>
      </AOSPage>
    </PluginGate>
  );
}
