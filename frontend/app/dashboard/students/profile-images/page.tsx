"use client";

/**
 * Students / Profile Images — grid uploader (plan Part 34 row 1).
 *
 * Kept (working, honest): vault FilePicker as the file source, the
 * /students/bulk-profile-images zip flow, per-file result rows, and the
 * naming contract (photos named by Admission Number).
 * Rewrite: AOSPage anatomy, keyboard-operable drop target (role=button +
 * Enter/Space — the audit's dock-a11y lesson applied to page content),
 * real win11-progressbar while processing, KPI band for the result summary
 * instead of ad-hoc colored boxes, and bilingual chrome.
 */

import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusChip } from "@/components/aos/kit/page-kit";
import { FilePicker } from "@/components/files/FilePicker";
import {
  fetchManagedFileAsFile,
  type ManagedFile,
} from "@/lib/services/files.service";
import {
  Image as ImageIcon, FolderOpen, FileArchive, Inbox,
} from "lucide-react";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, KpiCard, StatGrid,
} from "@/components/aos/kit/page-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";

interface UploadDetail {
  filename: string;
  student_id: string;
  status: "updated" | "not_found" | "error";
  message?: string;
}

interface UploadResult {
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
  details: UploadDetail[];
}

export default function StudentProfileImagesPage() {
  const { t } = useI18n();
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleFileSelect(files: ManagedFile[]) {
    const mf = files[0];
    if (!mf) return;
    setLoadingFile(true);
    try {
      // Fetch the picked vault file's bytes back as a native File so the
      // existing bulk-upload flow (multipart POST) keeps working unchanged.
      const fileObj = await fetchManagedFileAsFile(mf);
      if (!fileObj.name.toLowerCase().endsWith(".zip")) {
        toast.error(t("Please select a .zip file", ".zip फाइल छान्नुहोस्"));
        return;
      }
      setSelectedFile(fileObj);
      setResult(null);
    } catch {
      toast.error(t("Failed to load file from the file manager", "फाइल लोड हुन सकेन"));
    } finally {
      setLoadingFile(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(20);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      setProgress(50);
      const res = await api.post("/students/bulk-profile-images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProgress(100);

      const data = res.data?.data as UploadResult;
      setResult(data);
      toast.success(
        t(`Updated ${data.updated} student photo${data.updated !== 1 ? "s" : ""}`, `${data.updated} फोटो अद्यावधिक`)
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || t("Upload failed", "अपलोड असफल"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ImageIcon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Student Profile Images", "विद्यार्थी फोटो")}
        subtitle={t(
          "Bulk-upload photos as one ZIP archive named by Admission Number",
          "एउटा ZIP आर्काइभ — फाइलनाम भर्ना नम्बर अनुसार",
        )}
      />
      <AOSPageBody>
        <div className="max-w-4xl space-y-4">
          <DataPanel
            title={t("Batch Image Upload", "ब्याच फोटो अपलोड")}
            actions={
              <Button variant="outline" size="sm" onClick={() => setShowFilePicker(true)}>
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> {t("Browse Vault", "भान्ट खोल्नुहोस्")}
              </Button>
            }
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={t("Choose a zip file from the vault", "भान्टबाट zip छान्नुहोस्")}
              className="flex flex-col items-center gap-2 rounded-[var(--w11-radius-lg)] border-2 border-dashed p-10 text-center transition-colors cursor-pointer"
              style={{
                borderColor: selectedFile ? "rgba(16,124,16,0.5)" : "var(--w11-border-default)",
                background: selectedFile ? "rgba(16,124,16,0.05)" : "transparent",
              }}
              onClick={() => setShowFilePicker(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowFilePicker(true);
                }
              }}
            >
              {loadingFile ? (
                <>
                  <FileArchive className="h-10 w-10 animate-pulse" style={{ color: "var(--w11-text-secondary)" }} />
                  <p className="text-[13px]">{t("Loading file from the vault…", "भान्टबाट फाइल आउँदै…")}</p>
                </>
              ) : selectedFile ? (
                <>
                  <FileArchive className="h-10 w-10" style={{ color: "#107c10" }} />
                  <p className="text-[13px] font-semibold">{selectedFile.name}</p>
                  <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB — {t("Click to change", "फेर्न क्लिक")}
                  </p>
                </>
              ) : (
                <>
                  <FolderOpen className="h-10 w-10" style={{ color: "var(--w11-text-secondary)" }} />
                  <p className="text-[13px] font-semibold">{t("Choose a .zip archive", ".zip आर्काइभ छान्नुहोस्")}</p>
                  <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                    {t("Photos named by Admission Number (e.g. ADM1023.jpg) match automatically.", "भर्ना नम्बरमा नामाकरण (ADM1023.jpg) — स्वतः मिल्छ।")}
                  </p>
                </>
              )}
            </div>

            {uploading && (
              <div className="space-y-2 mt-4">
                <Progress value={progress} />
                <p className="text-[12px] text-center" style={{ color: "var(--w11-text-secondary)" }}>
                  {t("Uploading and matching photos…", "फोटो मिलान हुँदै…")}
                </p>
              </div>
            )}

            {selectedFile && !uploading && (
              <Button onClick={handleUpload} className="w-full mt-4" size="lg">
                <ImageIcon className="h-4 w-4 mr-2" /> {t("Upload & Match Student Photos", "अपलोड र मिलान")}
              </Button>
            )}
          </DataPanel>

          <div className="win11-infobar info">
            <div>
              <p className="text-[12px] font-medium">{t("How it works", "कसरी")}</p>
              <p className="text-[12px] mt-1">
                {t(
                  "1) ZIP of JPG/JPEG/PNG/WebP, each named with the student's Admission Number. 2) Photos that don't match a student are reported as Not Found — nothing is deleted.",
                  "१) JPG/PNG/WebP को ZIP, नाम भर्ना नम्बर। २) नमिल्दा 'नभेटियो' रिपोर्ट — केही हट्दैन।",
                )}
              </p>
            </div>
          </div>

          {result && (
            <DataPanel title={t("Upload Results", "नतिजा")}>
              <StatGrid min={130}>
                <KpiCard label={t("Total images", "कुल")} value={result.total} color="var(--w11-text-primary)" />
                <KpiCard label={t("Updated", "अद्यावधिक")} value={result.updated} color="#107c10" />
                <KpiCard label={t("Not found", "नभेटियो")} value={result.skipped} color={result.skipped ? "#d13438" : "var(--w11-text-primary)"} />
              </StatGrid>
              {result.errors && result.errors.length > 0 && (
                <div className="win11-infobar error mb-3">
                  <div>
                    <p className="text-[12px] font-medium">{t("Errors", "त्रुटि")}</p>
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-[12px]">{e}</p>
                    ))}
                  </div>
                </div>
              )}
              {result.details && result.details.length > 0 ? (
                <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: "var(--w11-border-subtle)" }}>
                  {result.details.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[12px] py-1.5 px-1">
                      <span className="font-mono truncate">{d.filename}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {d.student_id && <span style={{ color: "var(--w11-text-tertiary)" }}>{d.student_id}</span>}
                        <StatusChip
                          status={d.status === "updated" ? "active" : d.status === "error" ? "failed" : "pending"}
                          label={
                            d.status === "updated"
                              ? t("updated", "अद्यावधिक")
                              : d.status === "not_found"
                              ? t("not found", "नभेटियो")
                              : t("error", "त्रुटि")
                          }
                        />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title={t("No images were processed", "कुनै फोटो प्रशोधन भएन")}
                  body={t("Check that the ZIP contains image files.", "ZIP मा फोटो छन् कि हेर्नुहोस्।")}
                />
              )}
            </DataPanel>
          )}
        </div>

        <FilePicker
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          onSelect={handleFileSelect}
          title="Select ZIP Archive"
        />
      </AOSPageBody>
    </AOSPage>
  );
}
