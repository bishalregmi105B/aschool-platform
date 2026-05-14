"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ─── PLANS ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "NPR 0",
    period: "forever",
    description: "Get started with core features at no cost.",
    features: ["Up to 100 students", "School website", "Basic academics", "Community support"],
    highlight: false,
    badge: null,
  },
  {
    id: "starter",
    name: "Starter",
    price: "NPR 2,999",
    period: "/month",
    description: "Full operations for growing schools.",
    features: ["Up to 500 students", "All core modules", "Parent & student apps", "Priority support"],
    highlight: true,
    badge: "Most Popular",
  },
  {
    id: "pro",
    name: "Pro",
    price: "NPR 7,999",
    period: "/month",
    description: "Advanced tools for large institutions.",
    features: ["Unlimited students", "Multi-branch", "API access", "Dedicated manager"],
    highlight: false,
    badge: null,
  },
];

// ─── FORM SCHEMA ──────────────────────────────────────────────────────────────
const schoolInfoSchema = z.object({
  school_name: z.string().min(2, "School name must be at least 2 characters"),
  district: z.string().min(1, "District is required"),
  municipality: z.string().min(1, "Municipality is required"),
  type: z.enum(["public", "private", "community"], { errorMap: () => ({ message: "Select school type" }) }),
  level: z.enum(["primary", "lower_secondary", "secondary", "higher_secondary"], {
    errorMap: () => ({ message: "Select school level" }),
  }),
});

const adminSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().regex(/^(98|97|96)\d{8}$/, "Valid Nepal phone (98/97/96XXXXXXXX)"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type SchoolInfoForm = z.infer<typeof schoolInfoSchema>;
type AdminForm = z.infer<typeof adminSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = ["Choose Plan", "School Info", "Admin Setup"];
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i + 1 < step
                  ? "bg-primary text-primary-foreground"
                  : i + 1 === step
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1 < step ? "✓" : i + 1}
            </div>
            <p className={`text-[10px] mt-1 font-medium ${i + 1 === step ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-8 mb-4 transition-all ${i + 1 < step ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── STEP 1: PLAN SELECTION ──────────────────────────────────────────────────
function PlanStep({
  selected,
  onSelect,
  onNext,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelect(plan.id)}
            className={`relative rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md ${
              selected === plan.id
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/40"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[10px] font-bold uppercase px-3 py-0.5 rounded-full">
                {plan.badge}
              </span>
            )}
            <div className="flex items-start justify-between mb-3">
              <p className="font-bold text-base">{plan.name}</p>
              {selected === plan.id && (
                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs">✓</span>
              )}
            </div>
            <div className="mb-2">
              <span className="text-xl font-bold">{plan.price}</span>
              <span className="text-xs text-muted-foreground">{plan.period}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
            <ul className="space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-foreground/80">
                  <span className="text-primary mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground">
        All plans include a 14-day free trial. No credit card required.
      </p>
      <Button className="w-full" onClick={onNext} disabled={!selected}>
        Continue with {PLANS.find((p) => p.id === selected)?.name || "selected plan"} →
      </Button>
    </div>
  );
}

// ─── STEP 2: SCHOOL INFO ──────────────────────────────────────────────────────
function SchoolInfoStep({
  form,
  onNext,
  onBack,
}: {
  form: ReturnType<typeof useForm<SchoolInfoForm>>;
  onNext: () => void;
  onBack: () => void;
}) {
  const handleNext = form.handleSubmit(() => onNext());

  return (
    <form onSubmit={handleNext} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="school_name">School Name</Label>
        <Input id="school_name" placeholder="Nepal Model Secondary School" {...form.register("school_name")} />
        {form.formState.errors.school_name && (
          <p className="text-sm text-destructive">{form.formState.errors.school_name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Input id="district" placeholder="Kathmandu" {...form.register("district")} />
          {form.formState.errors.district && (
            <p className="text-sm text-destructive">{form.formState.errors.district.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="municipality">Municipality</Label>
          <Input id="municipality" placeholder="Kathmandu Metro" {...form.register("municipality")} />
          {form.formState.errors.municipality && (
            <p className="text-sm text-destructive">{form.formState.errors.municipality.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">School Type</Label>
          <select
            id="type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...form.register("type")}
          >
            <option value="">Select type</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="community">Community</option>
          </select>
          {form.formState.errors.type && (
            <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="level">School Level</Label>
          <select
            id="level"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...form.register("level")}
          >
            <option value="">Select level</option>
            <option value="primary">Primary (1–5)</option>
            <option value="lower_secondary">Lower Secondary (6–8)</option>
            <option value="secondary">Secondary (9–10)</option>
            <option value="higher_secondary">Higher Secondary (11–12)</option>
          </select>
          {form.formState.errors.level && (
            <p className="text-sm text-destructive">{form.formState.errors.level.message}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" className="flex-1">
          Continue →
        </Button>
      </div>
    </form>
  );
}

// ─── STEP 3: ADMIN SETUP ─────────────────────────────────────────────────────
function AdminStep({
  form,
  loading,
  onBack,
}: {
  form: ReturnType<typeof useForm<AdminForm>>;
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Your Full Name</Label>
        <Input id="name" placeholder="Ram Bahadur Thapa" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="admin@school.edu.np" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" placeholder="98XXXXXXXX" {...form.register("phone")} maxLength={10} />
          {form.formState.errors.phone && (
            <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm Password</Label>
          <Input id="confirm_password" type="password" placeholder="••••••••" {...form.register("confirm_password")} />
          {form.formState.errors.confirm_password && (
            <p className="text-sm text-destructive">{form.formState.errors.confirm_password.message}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={loading}>
          ← Back
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Create School Account"}
        </Button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
function RegisterPageContent() {
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-select plan from URL query param (e.g. /register?plan=starter)
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam && PLANS.find((p) => p.id === planParam)) {
      setSelectedPlan(planParam);
    }
  }, [searchParams]);

  const schoolForm = useForm<SchoolInfoForm>({ resolver: zodResolver(schoolInfoSchema) });
  const adminForm = useForm<AdminForm>({ resolver: zodResolver(adminSchema) });

  const onSubmit = adminForm.handleSubmit(async (adminData) => {
    const schoolData = schoolForm.getValues();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: schoolData.school_name,
          district: schoolData.district,
          municipality: schoolData.municipality,
          type: schoolData.type,
          level: schoolData.level,
          plan: selectedPlan,
          full_name: adminData.name,
          email: adminData.email,
          phone: adminData.phone,
          password: adminData.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Registration failed");
        return;
      }
      toast.success("Registration successful! Please verify your phone.");
      const devOtp = json.data?.dev_otp ? `&dev_otp=${json.data.dev_otp}` : "";
      router.push(`/verify-otp?phone=${encodeURIComponent(adminData.phone)}${devOtp}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  });

  const planInfo = PLANS.find((p) => p.id === selectedPlan);

  return (
    <Card className="shadow-lg w-full max-w-2xl mx-auto">
      <CardHeader className="text-center pb-2">
        <a href="/" className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2 hover:opacity-90">
          A
        </a>
        <CardTitle className="text-2xl">Create Your School</CardTitle>
        <CardDescription>
          {step === 1 && "Choose a plan to get started — upgrade anytime"}
          {step === 2 && "Tell us about your school"}
          {step === 3 && (
            <span>
              Setting up <strong>{schoolForm.watch("school_name") || "your school"}</strong> on the{" "}
              <span className="font-semibold text-primary capitalize">{planInfo?.name}</span> plan
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <StepIndicator step={step} />

        {step === 1 && (
          <PlanStep
            selected={selectedPlan}
            onSelect={setSelectedPlan}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <SchoolInfoStep
            form={schoolForm}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <form onSubmit={onSubmit}>
            <AdminStep
              form={adminForm}
              loading={loading}
              onBack={() => setStep(2)}
            />
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-sm text-muted-foreground">Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────