"use client";

/**
 * Circulation desk (plan 34-24 / Part 8 rule: search student → their loans →
 * issue/return). Left = the borrower (EntityPicker + ObjectHeader + current
 * loans with Return/Renew inline); right = the desk: barcode scan panel +
 * book picker + Issue action. Same endpoints as the old two-form layout.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityPicker } from "@/components/ui/entity-picker";
import { useDebounced } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  DetailSplit,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { ObjectHeader, ListView } from "@/components/aos/kit/detail-kit";
import { BookMarked, RotateCcw, ScanLine, Search, BookOpen, RefreshCw } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function CheckoutPage() {
  return <PluginGate slug="library"><CheckoutContent /></PluginGate>;
}

/** Barcode-first desk helper: scan a copy barcode and the backend resolves
 * copy + book + active issue in one lookup (keyboard-wedge friendly). */
function ScanPanel({ onPickedBook }: { onPickedBook: (bookId: string) => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [scan, setScan] = useState<any>(null);

  const lookup = useMutation({
    mutationFn: async (value: string) =>
      (await api.get(`/library/copies/scan/${encodeURIComponent(value.trim())}`)).data?.data,
    onSuccess: (d) => {
      setScan(d);
      if (d?.copy?.book_id && d?.copy?.status === "available") onPickedBook(d.copy.book_id);
    },
    onError: () => toast.error(t("No copy matches that barcode", "यस बारकोडसँग मिल्ने प्रतिलिपि छैन")),
  });

  return (
    <DataPanel
      title={
        <span className="flex items-center gap-2">
          <ScanLine className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> {t("Scan copy", "प्रतिलिपि स्क्यान")}
        </span>
      }
    >
      <div className="space-y-3">
        <form
          onSubmit={(e) => { e.preventDefault(); if (code.trim()) lookup.mutate(code); }}
          className="flex gap-2"
        >
          <Input
            autoFocus
            placeholder={t("Scan or type barcode / accession no…", "बारकोड स्क्यान/टाइप…")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" disabled={lookup.isPending || !code.trim()}>{t("Look up", "खोज्नुहोस्")}</Button>
        </form>
        {scan?.copy && (
          <div
            className="rounded-md border border-[var(--w11-border-subtle)] p-3 text-sm space-y-1"
            style={{ background: "var(--w11-control-hover)" }}
          >
            <div className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{scan.copy.book_title}</div>
            <div style={{ color: "var(--w11-text-secondary)" }}>
              {scan.copy.accession_no} · {scan.copy.status}
            </div>
            {scan.issue && scan.student && (
              <div style={{ color: "var(--w11-text-primary)" }}>
                {t("Issued to", "वितरित:")} <span className="font-medium">{scan.student.name}</span> — {t("due", "नियमित")}{" "}
                {scan.issue.due_date ? displayBS(scan.issue.due_date) : "—"}
              </div>
            )}
          </div>
        )}
      </div>
    </DataPanel>
  );
}

function CheckoutContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [bookId, setBookId] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const bookSearch = useDebounced(bookQuery, 250);

  const { data: settings } = useQuery({
    queryKey: ["library-settings"],
    queryFn: async () => (await api.get("/library/settings")).data?.data,
    staleTime: 5 * 60 * 1000,
  });

  const { data: books = [] } = useQuery({
    queryKey: ["checkout-books", bookSearch],
    queryFn: async () => {
      const r = await api.get("/library/books", { params: { search: bookSearch || undefined, per_page: 20 } });
      return r.data?.data || [];
    },
  });

  // The borrower's live loans — the desk's centre of gravity.
  const { data: loans, isFetching: loansFetching } = useQuery({
    queryKey: ["desk-loans", studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const r = await api.get("/library/issues", { params: { student_id: studentId, per_page: 50 } });
      return ((r.data?.data || []) as any[]).filter((i) => i.status !== "returned");
    },
  });

  const selectedBook = books.find((b: any) => b.id === bookId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["library-books"] });
    queryClient.invalidateQueries({ queryKey: ["library-issues"] });
    queryClient.invalidateQueries({ queryKey: ["desk-loans"] });
    queryClient.invalidateQueries({ queryKey: ["checkout-books"] });
  };

  const checkout = useMutation({
    mutationFn: async () => (await api.post("/library/issues", { book_id: bookId, student_id: studentId })).data,
    onSuccess: () => {
      invalidate();
      setBookId("");
      toast.success(t("Book issued", "किताब वितरण भयो"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Checkout failed — is the book still available?", "वितरण सकिएन")),
  });

  const returnBook = useMutation({
    mutationFn: async (issueId: string) => (await api.post(`/library/issues/${issueId}/return`, {})).data,
    onSuccess: (data) => {
      invalidate();
      toast.success(
        data?.overdue_days > 0
          ? `${t("Returned — fine", "फर्कियो — जरिवाना")}: Rs ${data.fine ?? 0} (${data.overdue_days} ${t("days late", "दिन ढिला")})`
          : t("Book returned successfully", "किताब फर्कियो"),
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Return failed", "फिर्ती सकिएन")),
  });

  const renew = useMutation({
    mutationFn: async (issueId: string) => (await api.post(`/library/issues/${issueId}/renew`, {})).data,
    onSuccess: () => { invalidate(); toast.success(t("Due date extended", "मिति थपियो")); },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Renewal failed", "नवीकरण सकिएन")),
  });

  const loanDays = Number(settings?.circulation?.loan_days);
  const perDay = settings?.fines?.per_day;
  const maxFine = settings?.fines?.max;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookMarked className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Circulation Desk", "सर्कुलेसन डेस्क")}
        subtitle={t("Find the borrower, see their loans, issue or return", "बorrower खोज्नुहोस्, loan हेर्नुहोस्, वितरण/फिर्ती")}
      />
      <AOSPageBody>
        <DetailSplit
          sidebarWidth="340px"
          sidebar={
            <div className="space-y-4">
              <DataPanel title={t("1 · Borrower", "१ · borrower")}>
                <div className="space-y-3">
                  <EntityPicker
                    value={studentId}
                    onChange={(id) => setStudentId(id)}
                    query={{ path: "/students", searchKey: "q", perPage: 20 }}
                    getOptions={(rows) =>
                      (rows as any[]).map((s) => ({
                        value: s.id,
                        label: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.full_name || s.id,
                        ne: s.first_name_nepali ? `${s.first_name_nepali}` : undefined,
                        hint: s.admission_number,
                      }))
                    }
                    placeholder={t("Search student by name or ID…", "नाम/ID ले खोज्नुहोस्…")}
                    nePlaceholder="नाम/ID ले खोज्नुहोस्…"
                  />
                  {studentId && (loansFetching || loans === undefined) && (
                    <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-2/3" /></div>
                  )}
                  {studentId && loans && (
                    <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                      {loans.length} {t("active loan(s)", "सक्रिय ऋण")}
                    </p>
                  )}
                </div>
              </DataPanel>

              <DataPanel
                title={t("2 · Their loans", "२ · तिनीहरूको ऋण")}
                actions={studentId ? (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => queryClient.invalidateQueries({ queryKey: ["desk-loans"] })} title={t("Refresh", "ताजा")}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loansFetching ? "animate-spin" : ""}`} />
                  </Button>
                ) : undefined}
              >
                {!studentId ? (
                  <EmptyState size="sm" icon={Search} title={t("Pick a borrower", "borrower छान्नुहोस्")} body={t("Search a student on the left to load their loans.", "विद्यार्थी खोजेर ऋण हेर्नुहोस्।")} />
                ) : !loans?.length ? (
                  <EmptyState size="sm" icon={BookOpen} title={t("No active loans", "सक्रिय ऋण छैन")} body={t("This student has nothing out — issue from the right.", "कुनै किताब बाहिर छैन।")} />
                ) : (
                  <ListView
                    aria-label={t("Current loans", "वर्तमान ऋण")}
                    items={loans.map((i: any) => {
                      const overdue = i.status === "overdue" || (i.due_date && new Date(i.due_date) < new Date());
                      return {
                        id: i.id,
                        primary: <span>{i.book_title || i.book_id}</span>,
                        secondary: (
                          <span className="flex items-center gap-2">
                            {t("Due", "नियमित")} {i.due_date ? displayBS(i.due_date) : "—"}
                          </span>
                        ),
                        trailing: (
                          <span className="flex items-center gap-1.5">
                            <StatusChip status={overdue ? "overdue" : "pending"} label={overdue ? t("Overdue", "ढिला") : t("Out", "बाहिर")} />
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={returnBook.isPending} onClick={() => returnBook.mutate(i.id)}>
                              <RotateCcw className="h-3 w-3 mr-1" />{t("Return", "फिर्ता")}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={renew.isPending} onClick={() => renew.mutate(i.id)}>
                              {t("Renew", "नवीकरण")}
                            </Button>
                          </span>
                        ),
                      };
                    })}
                  />
                )}
              </DataPanel>
            </div>
          }
        >
          {/* Right pane: the issue flow + scan. */}
          <div className="space-y-4">
            <ScanPanel onPickedBook={(id) => setBookId(id)} />

            <DataPanel title={t("3 · Issue a book", "३ · किताब वितरण")}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("Book", "किताब")}</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--w11-text-secondary)" }} />
                    <Input
                      placeholder={t("Search by title, author or ISBN…", "शीर्षक/लेखक/ISBN ले खोज्नुहोस्…")}
                      value={selectedBook ? `${selectedBook.title} (${selectedBook.available_copies}/${selectedBook.total_copies})` : bookQuery}
                      onFocus={() => { setBookId(""); }}
                      onChange={(e) => { setBookId(""); setBookQuery(e.target.value); }}
                      className="pl-7"
                    />
                  </div>
                  {bookQuery.trim() && !selectedBook && (
                    <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--w11-border-subtle)]">
                      <ListView
                        items={books.length === 0
                          ? []
                          : books.map((b: any) => ({
                              id: b.id,
                              primary: <span>{b.title} <span style={{ color: "var(--w11-text-secondary)" }}>— {b.author}</span></span>,
                              trailing: (
                                <span className={`win11-chip ml-2 shrink-0 ${(b.available_copies ?? 0) > 0 ? "subtle" : "error"}`}>
                                  {b.available_copies}/{b.total_copies}
                                </span>
                              ),
                              disabled: (b.available_copies ?? 0) <= 0,
                            }))}
                        onSelect={(id) => { setBookId(id); setBookQuery(""); }}
                        empty={<p className="p-3 text-xs" style={{ color: "var(--w11-text-secondary)" }}>{t("No books match.", "कुनै किताब भेटिएन।")}</p>}
                      />
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={() => checkout.mutate()}
                  disabled={checkout.isPending || !bookId || !studentId}
                >
                  {checkout.isPending ? <Spinner className="mr-2" /> : <BookMarked className="h-4 w-4 mr-2" />}
                  {studentId ? t("Issue to borrower", "वितरण गर्नुहोस्") : t("Pick a borrower first", "पहिले borrower छान्नुहोस्")}
                </Button>

                {(perDay != null || Number.isFinite(loanDays)) && (
                  <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    {Number.isFinite(loanDays) && `${t("Loan period", "ऋण अवधि")}: ${loanDays} ${t("days", "दिन")}. `}
                    {perDay != null && `${t("Fine", "जरिवाना")}: Rs ${perDay}/${t("day", "दिन")}${maxFine != null ? `, ${t("max", "अधिकतम")} Rs ${maxFine}` : ""}. `}
                    {t("Configurable in plugin settings.", "प्लगिन सेटिङमा बदलिन्छ।")}
                  </p>
                )}
              </div>
            </DataPanel>
          </div>
        </DetailSplit>
      </AOSPageBody>
    </AOSPage>
  );
}
