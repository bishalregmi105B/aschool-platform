"use client";

/**
 * "Apply online" — the S-A5 public admission application, now a 3-step
 * guest wizard (A4 grammar, Part 39/45.3; the InstiKit guest-funnel steal).
 *
 * Posts to /website/public/<slug>/admission/registration (no auth, slug
 * scoped, rate-limited 5/h). The response carries the registration number
 * AND a one-time verification token that doubles as the applicant's
 * tracking receipt, so the success screen shows both + a status timeline.
 *
 * Step grammar (GOV.UK "check answers" + NN/g long-form research):
 *  1 Student details · 2 Guardian + documents you'll bring · 3 School's
 *  extra questions + review → submit. Back never loses answers; each step
 *  validates before Next.
 *
 * FLAG: the guest cannot UPLOAD files — POST /files is jwt_required — so
 * step 2 records a DOCUMENT CHECKLIST (name + reference), stored in the
 * registration's `documents` JSONB the backend already accepts, with an
 * explicit "bring originals to the office" note. No fake upload widget.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wizard } from "@/components/ui/wizard";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface CustomFieldDef {
  id: string;
  label: string;
  label_nepali?: string | null;
  field_type: "text" | "textarea" | "number" | "date" | "select" | "multiselect" | "checkbox";
  required: boolean;
  choices: string[];
}

interface SubmitResult {
  id: string;
  registration_number: string;
  verification_token: string;
  status: string;
  message: string;
}

type DocEntry = { name: string; ref: string };

interface FormState {
  student_first_name: string;
  student_last_name: string;
  student_dob_bs: string;
  gender: string;
  previous_school: string;
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  guardian_email: string;
  documents: DocEntry[];
}

const initial: FormState = {
  student_first_name: "",
  student_last_name: "",
  student_dob_bs: "",
  gender: "",
  previous_school: "",
  guardian_name: "",
  guardian_relation: "",
  guardian_phone: "",
  guardian_email: "",
  documents: [],
};

const DOC_OPTIONS = [
  "Birth certificate / नागरिकता प्रमाणपत्र (copy)",
  "Last report card / नम्बर शेिट",
  "Transfer certificate",
  "Character certificate",
  "Recommendation letter",
  "Student photo (recent)",
];

function errMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: unknown } } };
  const raw = e?.response?.data?.error;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    return String((raw as { message?: unknown }).message || fallback);
  }
  return fallback;
}

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#0e3b2e)]/30";

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-gray-800">
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

export function ApplyOnlineForm({ slug }: { slug: string }) {
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [defsLoading, setDefsLoading] = useState(true);
  const [defsError, setDefsError] = useState("");
  const [f, setF] = useState<FormState>(initial);
  // dynamic_fields keyed by def id (checkbox: boolean, multiselect: string[]).
  const [dynamic, setDynamic] = useState<Record<string, string | string[] | boolean>>({});
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    let alive = true;
    api
      .get(`/custom-fields/defs/public/${slug}/student_registration`)
      .then((res) => {
        if (alive) setDefs((res.data?.data?.fields as CustomFieldDef[]) || []);
      })
      .catch(() => {
        if (alive) setDefsError("Could not load the school's extra questions — you can still submit the main form.");
      })
      .finally(() => {
        if (alive) setDefsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const trackingUrl = useMemo(() => {
    if (!result) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/school/${slug}/admission?track=${result.id}&token=${encodeURIComponent(
      result.verification_token,
    )}`;
  }, [result, slug]);

  /* ── step validation ─────────────────────────────────────────────────── */

  const v1 = () =>
    f.student_first_name.trim().length < 2 ? "Enter the student's first name." : null;

  const v2 = () => {
    if (f.guardian_name.trim().length < 2) return "Enter the guardian's name.";
    if (!/^(98|97|96)\d{8}$/.test(f.guardian_phone.trim()))
      return "Enter a valid Nepal mobile number (98/97/96 followed by 8 digits).";
    if (f.guardian_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.guardian_email))
      return "That email address looks incomplete.";
    return null;
  };

  const v3 = () => {
    for (const def of defs) {
      if (!def.required) continue;
      const v = dynamic[def.id];
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length) || (def.field_type === "checkbox" && v !== true)) {
        return `Please answer: ${def.label}`;
      }
    }
    return null;
  };

  async function submit() {
    setSubmitError("");
    const dynamicFields: Record<string, string | string[] | boolean> = {};
    for (const [key, value] of Object.entries(dynamic)) {
      if (
        value === true ||
        (Array.isArray(value) && value.length) ||
        (typeof value === "string" && value.trim())
      ) {
        dynamicFields[key] = value;
      }
    }
    const body: Record<string, unknown> = {
      student_first_name: f.student_first_name.trim(),
      student_last_name: f.student_last_name.trim() || undefined,
      student_dob_bs: f.student_dob_bs || undefined,
      gender: f.gender || undefined,
      previous_school: f.previous_school.trim() || undefined,
      guardian_name: f.guardian_name.trim(),
      guardian_relation: f.guardian_relation || undefined,
      guardian_phone: f.guardian_phone.trim(),
      guardian_email: f.guardian_email.trim() || undefined,
      documents: f.documents
        .filter((d) => d.name)
        // Shape chosen so the admin review drawer's `d.label || d.file_id`
        // render shows the checklist line (guests have no file_id — upload
        // is auth-gated).
        .map((d) => ({ label: d.ref.trim() ? `${d.name} — ${d.ref.trim()}` : d.name })),
      dynamic_fields: Object.keys(dynamicFields).length ? dynamicFields : undefined,
      source: "website",
    };
    try {
      const res = await api.post(`/website/public/${slug}/admission/registration`, body);
      setResult(res.data?.data as SubmitResult);
    } catch (err) {
      setSubmitError(errMessage(err, "Could not submit the application. Please try again."));
    }
  }

  /* ── success screen ──────────────────────────────────────────────────── */

  if (result) {
    return (
      <div className="border rounded-xl p-6 md:p-8 bg-white" data-testid="apply-success">
        <div className="text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-xl font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
            Application Received
          </h3>
          <p className="text-gray-600 text-sm mb-5">{result.message}</p>
        </div>
        <div className="rounded-lg border bg-gray-50 p-4 text-center space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Registration Number</p>
          <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
            {result.registration_number}
          </p>
          <p className="text-xs text-gray-500">Save this number — quote it when the office calls.</p>
        </div>
        <div className="mt-5">
          <StatusTimeline
            steps={[
              { label: "Submitted", at: "now", detail: "We have your application" },
              { label: "Under review", detail: "The office checks the details" },
              { label: "Approved", detail: "You'll be called for document verification + enrollment" },
            ]}
            currentIndex={0}
          />
        </div>
        <div className="mt-6 rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Track your application</p>
          <p className="text-xs text-gray-500">
            Bookmark this private link to check your status any time:
          </p>
          <input
            readOnly
            value={trackingUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full border rounded-md px-3 py-2 text-xs bg-gray-50 font-mono"
          />
          <a
            href={trackingUrl}
            className="inline-block text-sm underline"
            style={{ color: "var(--color-primary)" }}
          >
            Check status now →
          </a>
        </div>
        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setResult(null);
              setDynamic({});
              setF(initial);
            }}
            className="text-sm underline"
            style={{ color: "var(--color-primary)" }}
          >
            Submit another application
          </button>
        </div>
      </div>
    );
  }

  /* ── the wizard ──────────────────────────────────────────────────────── */

  const steps = [
    {
      key: "student",
      title: "Student details",
      description: "Who is applying — names as on the birth certificate work best.",
      validate: v1,
      content: (
        <div className="p-4 md:p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Student's First Name" required>
              <Input value={f.student_first_name} onChange={(e) => set("student_first_name", e.target.value)} placeholder="निबेदिता / Nivedita" className={inputCls} />
            </Field>
            <Field label="Student's Last Name">
              <Input value={f.student_last_name} onChange={(e) => set("student_last_name", e.target.value)} placeholder="Thapa" className={inputCls} />
            </Field>
            <Field label="Date of Birth (B.S.)">
              <BSDateInput emit="bs" value={f.student_dob_bs} onChange={(v) => set("student_dob_bs", v)} placeholder="2081-01-15" />
            </Field>
            <Field label="Gender">
              <AdvancedSelect
                value={f.gender}
                onChange={(v) => set("gender", v)}
                placeholder="Select…"
                options={[
                  { value: "male", label: "Male / छोरा" },
                  { value: "female", label: "Female / छोरी" },
                  { value: "other", label: "Other / अन्य" },
                ]}
              />
            </Field>
          </div>
          <Field label="Previous School" hint="Only if transferring — leave blank for first admission.">
            <Input value={f.previous_school} onChange={(e) => set("previous_school", e.target.value)} placeholder="Shree Saraswati Secondary School" className={inputCls} />
          </Field>
        </div>
      ),
    },
    {
      key: "guardian",
      title: "Guardian & documents",
      description: "We call THIS number — keep it active. Documents are verified at the office.",
      validate: v2,
      content: (
        <div className="p-4 md:p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Guardian's Name" required>
              <Input value={f.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} placeholder="अभिभावकको नाम" className={inputCls} />
            </Field>
            <Field label="Relation with Student">
              <AdvancedSelect
                value={f.guardian_relation}
                onChange={(v) => set("guardian_relation", v)}
                placeholder="Father / Mother / …"
                options={["Father", "Mother", "Grandparent", "Sibling", "Other"].map((r) => ({ value: r.toLowerCase(), label: r }))}
              />
            </Field>
            <Field label="Phone Number" required hint="Nepali mobile — the office will call this number.">
              <Input value={f.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="98XXXXXXXX" className={inputCls} />
            </Field>
            <Field label="Email" hint="Optional — used only if the school sends updates by email.">
              <Input value={f.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} type="email" placeholder="guardian@example.com" className={inputCls} />
            </Field>
          </div>

          <fieldset className="rounded-lg border border-gray-200 p-4 space-y-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">Documents you will bring</legend>
            <p className="text-xs text-gray-500">
              Online file upload isn't available for guests — tick what you already have and note any
              certificate numbers. The office verifies originals during review.
            </p>
            {f.documents.map((d, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2">
                <AdvancedSelect
                  className="flex-1"
                  value={d.name}
                  onChange={(v) =>
                    set("documents", f.documents.map((x, k) => (k === i ? { ...x, name: v } : x)))
                  }
                  placeholder="Document…"
                  options={DOC_OPTIONS.map((o) => ({ value: o, label: o }))}
                />
                <Input
                  value={d.ref}
                  onChange={(e) =>
                    set("documents", f.documents.map((x, k) => (k === i ? { ...x, ref: e.target.value } : x)))
                  }
                  placeholder="Number (if printed)"
                  className={inputCls + " sm:w-48"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove document"
                  onClick={() => set("documents", f.documents.filter((_, k) => k !== i))}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("documents", [...f.documents, { name: "", ref: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add document
            </Button>
          </fieldset>
        </div>
      ),
    },
    {
      key: "review",
      title: defs.length ? "School's questions & review" : "Review & submit",
      description: "Check everything, then submit — you get a registration number instantly.",
      validate: v3,
      content: (
        <div className="p-4 md:p-5 space-y-5">
          {defsLoading && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the school&apos;s extra questions…
            </p>
          )}
          {defsError && <p className="text-sm text-amber-700">{defsError}</p>}
          {defs.map((def) => (
            <Field
              key={def.id}
              label={`${def.label}${def.label_nepali ? ` · ${def.label_nepali}` : ""}`}
              required={def.required}
            >
              <DynamicInput
                def={def}
                value={dynamic[def.id]}
                onChange={(v) => setDynamic((prev) => ({ ...prev, [def.id]: v }))}
              />
            </Field>
          ))}

          <div className="rounded-lg border bg-gray-50 p-4 text-sm space-y-1.5">
            <p className="font-semibold text-gray-800">Review — use Back to fix anything</p>
            <ReviewRow label="Student" value={`${f.student_first_name} ${f.student_last_name}`.trim()} />
            {f.student_dob_bs && <ReviewRow label="DOB (BS)" value={f.student_dob_bs} />}
            {f.gender && <ReviewRow label="Gender" value={f.gender} />}
            {f.previous_school && <ReviewRow label="Previous school" value={f.previous_school} />}
            <ReviewRow label="Guardian" value={`${f.guardian_name}${f.guardian_relation ? ` (${f.guardian_relation})` : ""}`} />
            <ReviewRow label="Phone" value={f.guardian_phone} />
            {f.guardian_email && <ReviewRow label="Email" value={f.guardian_email} />}
            {f.documents.filter((d) => d.name).length > 0 && (
              <ReviewRow
                label="Bringing"
                value={f.documents
                  .filter((d) => d.name)
                  .map((d) => (d.ref ? `${d.name} #${d.ref}` : d.name))
                  .join(", ")}
              />
            )}
          </div>

          {submitError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="border rounded-xl bg-white p-5 md:p-7 win11">
      <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
        Apply Online
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Three short steps — the school office reviews every application and calls you. No account needed.
      </p>
      <Wizard steps={steps} onFinish={submit} finishLabel="Submit Application" compact />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex gap-2">
      <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-gray-400">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </p>
  );
}

/** Renders one custom-fields def by field_type. */
function DynamicInput({
  def,
  value,
  onChange,
}: {
  def: CustomFieldDef;
  value: string | string[] | boolean | undefined;
  onChange: (value: string | string[] | boolean) => void;
}) {
  switch (def.field_type) {
    case "textarea":
      return (
        <Textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          step="any"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "date":
      return (
        <BSDateInput
          emit="bs"
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
          placeholder="2081-01-15"
        />
      );
    case "select":
      return (
        <AdvancedSelect
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
          placeholder="Select…"
          options={(def.choices || []).map((c) => ({ value: c, label: c }))}
        />
      );
    case "multiselect":
      return (
        <MultiSelect
          value={Array.isArray(value) ? value : []}
          onChange={(vals) => onChange(vals)}
          options={(def.choices || []).map((c) => ({ value: c, label: c }))}
        />
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
          <span>Yes</span>
        </label>
      );
    default:
      return (
        <Input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
  }
}

/* ── Track application ────────────────────────────────────────────────────
 * id + token (from the submission receipt) → status card. Also accepts
 * ?track=<id>&token=<token> deep links from the success screen. */

interface TrackStatus {
  registration_number: string;
  status: string;
  student_name: string;
  review_notes?: string | null;
  submitted_at?: string | null;
}

const STATUS_STEPS = ["submitted", "under_review", "approved", "converted"];
const STEP_LABELS = ["Submitted", "Under review", "Approved", "Enrolled"];

export function TrackApplication({ slug }: { slug: string }) {
  const [id, setId] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<TrackStatus | null>(null);

  // Deep link from the success screen (?track=<id>&token=<token>).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tId = params.get("track");
    const tToken = params.get("token");
    if (tId && tToken) {
      setId(tId);
      setToken(tToken);
    }
  }, []);

  async function handleTrack(idValue?: string, tokenValue?: string) {
    const useId = (idValue ?? id).trim();
    const useToken = (tokenValue ?? token).trim();
    if (!useId || !useToken) {
      setError("Enter both the application ID and the tracking token.");
      return;
    }
    setLoading(true);
    setError("");
    setStatus(null);
    try {
      const res = await api.get(
        `/website/public/${slug}/admission/registration/${encodeURIComponent(useId)}?token=${encodeURIComponent(useToken)}`,
      );
      setStatus(res.data?.data as TrackStatus);
    } catch {
      setError("No application found for that ID and token. Check your saved tracking link.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-track when arriving via a tracking link.
  useEffect(() => {
    if (id && token) void handleTrack(id, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const stepIdx = status ? STATUS_STEPS.indexOf(status.status) : -1;
  const rejected = status?.status === "rejected";

  return (
    <div className="border rounded-xl bg-white p-6" data-testid="track-application">
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
        Track Application
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Use the application ID and token from your submission receipt.
      </p>
      <form
        className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void handleTrack();
        }}
      >
        <div>
          <Label className="mb-1 block text-xs font-medium text-gray-600">Application ID</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 6f1c…" className={inputCls} />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-gray-600">Tracking Token</Label>
          <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="from your receipt link" className={inputCls} />
        </div>
        <Button type="submit" disabled={loading} className="h-11">
          {loading ? "Checking…" : "Check Status"}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {status && (
        <div className="mt-4 rounded-lg border bg-gray-50 p-4" data-testid="track-result">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500">Registration Number</p>
              <p className="font-bold">{status.registration_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Applicant</p>
              <p className="font-medium text-sm">{status.student_name}</p>
            </div>
          </div>
          <div className="mt-4 win11">
            {rejected ? (
              <p className="text-sm font-medium text-red-700">
                Not approved{status.review_notes ? ` — note from the school: ${status.review_notes}` : ""}
              </p>
            ) : (
              <StatusTimeline
                steps={STEP_LABELS.map((label) => ({ label }))}
                currentIndex={Math.max(0, stepIdx)}
                orientation="horizontal"
              />
            )}
          </div>
          {status.submitted_at && (
            <p className="mt-2 text-[11px] text-gray-500">
              Submitted {new Date(status.submitted_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
