"use client";

/**
 * "Apply online" — the S-A5 public admission application.
 *
 * Posts to /website/public/<slug>/admission/registration (no auth, slug
 * scoped). The response carries the registration number AND a one-time
 * verification token that doubles as the applicant's tracking receipt, so
 * the success screen shows both. Custom questions come from the school's
 * custom-fields defs (form_name=student_registration, public read).
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

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

function errMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: unknown } } };
  const raw = e?.response?.data?.error;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    return String((raw as { message?: unknown }).message || fallback);
  }
  return fallback;
}

export function ApplyOnlineForm({ slug }: { slug: string }) {
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [defsLoading, setDefsLoading] = useState(true);
  const [defsError, setDefsError] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  // Radix selects don't submit via FormData — tracked controls.
  const [gender, setGender] = useState("");
  const [dobBS, setDobBS] = useState("");
  // dynamic_fields keyed by def id (checkbox: boolean, multiselect: string[]).
  const [dynamic, setDynamic] = useState<Record<string, string | string[] | boolean>>({});

  useEffect(() => {
    let alive = true;
    api
      .get(`/custom-fields/defs/public/${slug}/student_registration`)
      .then((res) => {
        if (alive) setDefs((res.data?.data?.fields as CustomFieldDef[]) || []);
      })
      .catch(() => {
        if (alive) setDefsError("Could not load the extra questions for this form.");
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      student_first_name: String(fd.get("student_first_name") || "").trim(),
      guardian_name: String(fd.get("guardian_name") || "").trim(),
      guardian_phone: String(fd.get("guardian_phone") || "").trim(),
    };
    for (const key of [
      "student_last_name",
      "guardian_relation",
      "guardian_email",
      "previous_school",
    ]) {
      const v = String(fd.get(key) || "").trim();
      if (v) body[key] = v;
    }
    if (dobBS) body.student_dob_bs = dobBS;
    if (gender) body.gender = gender;
    // Only send non-empty dynamic answers, keyed by the def id.
    const dynamicFields: Record<string, string | string[] | boolean> = {};
    for (const [key, value] of Object.entries(dynamic)) {
      if (value === true || (Array.isArray(value) && value.length) || (typeof value === "string" && value.trim())) {
        dynamicFields[key] = value;
      }
    }
    if (Object.keys(dynamicFields).length) body.dynamic_fields = dynamicFields;

    try {
      const res = await api.post(`/website/public/${slug}/admission/registration`, body);
      setResult(res.data?.data as SubmitResult);
    } catch (err) {
      setError(errMessage(err, "Could not submit the application. Please try again."));
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <div className="border rounded-lg p-6 md:p-8" data-testid="apply-success">
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
        <div className="mt-4 rounded-lg border p-4 space-y-2">
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
              setGender("");
              setDobBS("");
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

  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
        Apply Online
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Fill the form below — the school office will review it and contact you.
      </p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Student&apos;s First Name *</label>
            <input name="student_first_name" required className="w-full border rounded-md px-3 py-2 text-sm" placeholder="अनिवार्य — first name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Student&apos;s Last Name</label>
            <input name="student_last_name" className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Thapa" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date of Birth (B.S.)</label>
            <BSDateInput emit="bs" value={dobBS} onChange={(v) => setDobBS(v)} placeholder="2081-01-15" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gender</label>
            <AdvancedSelect
              value={gender}
              onChange={(v) => setGender(v)}
              placeholder="Select…"
              options={[
                { value: "male", label: "Male / छोरा" },
                { value: "female", label: "Female / छोरी" },
                { value: "other", label: "Other / अन्य" },
              ]}
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Guardian&apos;s Name *</label>
            <input name="guardian_name" required className="w-full border rounded-md px-3 py-2 text-sm" placeholder="अभिभावकको नाम" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Relation with Student</label>
            <input name="guardian_relation" className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Father / Mother / ..." />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number *</label>
            <input name="guardian_phone" type="tel" required className="w-full border rounded-md px-3 py-2 text-sm" placeholder="98XXXXXXXX" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="guardian_email" type="email" className="w-full border rounded-md px-3 py-2 text-sm" placeholder="guardian@example.com" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Previous School</label>
          <input name="previous_school" className="w-full border rounded-md px-3 py-2 text-sm" placeholder="If transferring" />
        </div>

        {defsLoading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading form questions…
          </p>
        )}
        {defsError && <p className="text-sm text-amber-700">{defsError}</p>}

        {defs.map((def) => (
          <div key={def.id}>
            <label className="block text-sm font-medium mb-1">
              {def.label}
              {def.label_nepali ? <span className="text-gray-400"> · {def.label_nepali}</span> : null}
              {def.required ? " *" : ""}
            </label>
            <DynamicInput
              def={def}
              value={dynamic[def.id]}
              onChange={(v) => setDynamic((prev) => ({ ...prev, [def.id]: v }))}
            />
          </div>
        ))}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full py-3 rounded-md text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {sending ? "Submitting…" : "Submit Application"}
        </button>
      </form>
    </div>
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
        <textarea
          rows={3}
          required={def.required}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      );
    case "number":
      return (
        <input
          type="number"
          step="any"
          required={def.required}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
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
          <Checkbox
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <span>Yes</span>
        </label>
      );
    default:
      return (
        <input
          type="text"
          required={def.required}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
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

  return (
    <div className="border rounded-lg p-6" data-testid="track-application">
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
          <label className="block text-xs font-medium mb-1 text-gray-600">Application ID</label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="e.g. 6f1c…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600">Tracking Token</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="from your receipt link"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md text-white text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading ? "Checking…" : "Check Status"}
        </button>
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
          <div className="mt-3 flex items-center gap-1">
            {STATUS_STEPS.map((step, i) => {
              const rejected = status.status === "rejected";
              const reached = rejected ? i === 0 : stepIdx >= i && stepIdx >= 0;
              const current = rejected ? false : stepIdx === i;
              return (
                <div key={step} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full ${current ? "bg-[var(--color-primary)]" : reached ? "bg-[var(--color-primary)]/40" : "bg-gray-200"}`}
                  />
                  <p className={`mt-1 text-[10px] ${current ? "font-semibold" : "text-gray-500"}`}>
                    {step.replace("_", " ")}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-sm font-medium capitalize">
            Status:{" "}
            <span style={{ color: "var(--color-primary)" }}>
              {status.status.replace("_", " ")}
            </span>
          </p>
          {status.status === "rejected" && status.review_notes && (
            <p className="mt-1 text-xs text-red-600">Note from the school: {status.review_notes}</p>
          )}
          {status.submitted_at && (
            <p className="mt-1 text-[11px] text-gray-500">
              Submitted {new Date(status.submitted_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
