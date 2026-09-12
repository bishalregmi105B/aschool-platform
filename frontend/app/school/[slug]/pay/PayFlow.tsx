"use client";

/**
 * "Pay fees without login" — S-A5 A-22 guest checkout.
 *
 * Step 1: lookup by enrollment number or guardian phone (no account needed).
 * Step 2: pick outstanding bills (checkboxes + running total).
 * Step 3: pick eSewa/Khalti → POST /payments/initiate. eSewa returns form
 * fields that must be browser-POSTed to its epay endpoint (mobile clients
 * can't launchUrl a POST), Khalti returns a payment_url to redirect to.
 * The gateway confirms server-to-server via /webhooks/<gw>/callback; the
 * family verifies the receipt in the parent app afterwards.
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Loader2, Wallet } from "lucide-react";

interface OutstandingBill {
  collection_id: string;
  fee_type: string;
  due_amount: number;
  month_bs?: string | null;
}

interface LookupResult {
  student_id: string;
  student_name: string;
  class_name?: string | null;
  outstanding: OutstandingBill[];
}

type Provider = "esewa" | "khalti";

interface CheckoutPayload {
  payment_url?: string;
  form_data?: Record<string, string>;
  [key: string]: unknown;
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

/** Browser POST of eSewa's form_data to its epay endpoint (hidden form). */
function submitEsewaForm(checkout: CheckoutPayload) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkout.payment_url || "";
  form.style.display = "none";
  for (const [name, value] of Object.entries(checkout.form_data || {})) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function PayFlow({ slug }: { slug: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState<LookupResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [provider, setProvider] = useState<Provider>("esewa");
  const [payerPhone, setPayerPhone] = useState("");
  const [initiating, setInitiating] = useState(false);
  const handedOff = useRef(false);

  const selectedBills = useMemo(
    () => (account?.outstanding || []).filter((b) => selected[b.collection_id]),
    [account, selected],
  );
  const total = useMemo(
    () => selectedBills.reduce((sum, b) => sum + Number(b.due_amount || 0), 0),
    [selectedBills],
  );

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLooking(true);
    setError("");
    setAccount(null);
    setSelected({});
    try {
      const res = await api.post(`/website/public/${slug}/payments/lookup`, {
        student_identifier: identifier.trim(),
      });
      const data = res.data?.data as LookupResult;
      if (!data?.outstanding?.length) {
        setError(`No outstanding dues found for ${data?.student_name || "that student"}.`);
      } else {
        setAccount(data);
        setStep(2);
      }
    } catch (err) {
      setError(errMessage(err, "No student found for that identifier."));
    } finally {
      setLooking(false);
    }
  }

  async function handleInitiate() {
    if (!selectedBills.length) return;
    setInitiating(true);
    setError("");
    try {
      const res = await api.post(`/website/public/${slug}/payments/initiate`, {
        collection_ids: selectedBills.map((b) => b.collection_id),
        provider,
        payer_phone: payerPhone.trim() || undefined,
      });
      const data = res.data?.data as { checkout: CheckoutPayload; message?: string };
      const checkout = data?.checkout || {};
      handedOff.current = true;
      if (provider === "esewa" && checkout.form_data && checkout.payment_url) {
        submitEsewaForm(checkout);
      } else if (checkout.payment_url) {
        window.location.href = String(checkout.payment_url);
      } else {
        handedOff.current = false;
        setError("The payment gateway did not return a checkout target. Please contact the school office.");
      }
    } catch (err) {
      setError(errMessage(err, "Could not start the payment. Please try again."));
    } finally {
      setInitiating(false);
    }
  }

  const rs = (n: number) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;

  return (
    <div className="border rounded-lg p-6" data-testid="guest-pay-flow">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        {["Find dues", "Select bills", "Pay"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
                step > i ? "text-white" : "bg-gray-100 text-gray-400"
              }`}
              style={step > i ? { backgroundColor: "var(--color-primary)" } : undefined}
            >
              {i + 1}
            </span>
            <span className={step > i ? "font-semibold" : "text-gray-400"}>{label}</span>
            {i < 2 && <span className="mx-1 h-px w-6 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1 — lookup */}
      {step === 1 && (
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Enrollment Number or Guardian Phone *
            </label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g. 2081-0142 or 98XXXXXXXX"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              No login needed — we look up the pending bills for that student.
            </p>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={looking}
            className="w-full py-3 rounded-md text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {looking && <Loader2 className="h-4 w-4 animate-spin" />}
            {looking ? "Searching…" : "Find Dues"}
          </button>
        </form>
      )}

      {/* Step 2 — outstanding bills */}
      {step === 2 && account && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{account.student_name}</p>
              {account.class_name && (
                <p className="text-xs text-gray-500">{account.class_name}</p>
              )}
            </div>
            <button
              onClick={() => {
                setStep(1);
                setAccount(null);
                setError("");
              }}
              className="text-xs underline text-gray-500"
            >
              Not you? Search again
            </button>
          </div>

          <div className="rounded-lg border divide-y">
            {account.outstanding.map((bill) => (
              <label
                key={bill.collection_id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selected[bill.collection_id])}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [bill.collection_id]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                  style={{ accentColor: "var(--color-primary)" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{bill.fee_type}</p>
                  {bill.month_bs && (
                    <p className="text-xs text-gray-500">Month: {bill.month_bs}</p>
                  )}
                </div>
                <p className="text-sm font-bold">{rs(bill.due_amount)}</p>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 border px-4 py-3">
            <p className="text-sm">
              {selectedBills.length} bill{selectedBills.length === 1 ? "" : "s"} selected
            </p>
            <p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
              {rs(total)}
            </p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={() => selectedBills.length && setStep(3)}
            disabled={!selectedBills.length}
            className="w-full py-3 rounded-md text-white font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Continue to Payment
          </button>
        </div>
      )}

      {/* Step 3 — provider + handoff */}
      {step === 3 && account && (
        <div className="space-y-4">
          <p className="text-sm">
            Paying <span className="font-bold">{rs(total)}</span> for{" "}
            <span className="font-medium">{account.student_name}</span>
            {selectedBills.length > 1 ? ` (${selectedBills.length} bills)` : ""}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: "esewa", label: "eSewa" },
                { key: "khalti", label: "Khalti" },
              ] as { key: Provider; label: string }[]
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setProvider(p.key)}
                className={`rounded-lg border-2 px-4 py-4 text-sm font-semibold ${
                  provider === p.key ? "border-[var(--color-primary)] bg-green-50/50" : "border-gray-200"
                }`}
                style={provider === p.key ? { borderColor: "var(--color-primary)" } : undefined}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payer Phone (optional)</label>
            <input
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Used by Khalti for customer info"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={() => void handleInitiate()}
            disabled={initiating}
            className="w-full py-3 rounded-md text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {initiating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting payment…
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" /> Pay {rs(total)} with{" "}
                {provider === "esewa" ? "eSewa" : "Khalti"}
              </>
            )}
          </button>

          <button
            onClick={() => {
              setStep(2);
              setError("");
            }}
            disabled={initiating}
            className="w-full text-xs underline text-gray-500"
          >
            Back to bill selection
          </button>

          <p className="text-[11px] text-gray-500 text-center">
            After the payment completes, the school is notified automatically. Check the receipt in
            the parent app (login required) or with the school office.
          </p>
        </div>
      )}

      {/* If the user navigates back after the gateway handoff without a
          redirect (popup blockers etc.), keep the messaging visible. */}
      {handedOff.current && (
        <p className="mt-3 text-xs text-center text-gray-500">
          If you were not redirected, complete the payment from the {provider === "esewa" ? "eSewa" : "Khalti"} page
          that opened, then verify the receipt in the parent app.
        </p>
      )}
    </div>
  );
}
