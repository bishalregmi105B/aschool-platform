"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  GraduationCap,
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  Lock,
} from "lucide-react";

// ─── PLANS ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "NPR 0",
    period: "forever",
    description: "Get started with essential school management features.",
    features: [
      "Up to 100 students",
      "Public School Website",
      "Attendance & Basic Academics",
      "Notice Board & SMS Alerts",
    ],
    highlight: false,
    badge: null,
  },
  {
    id: "starter",
    name: "Starter",
    price: "NPR 399",
    period: "/month",
    description: "Complete operations for growing schools & colleges.",
    features: [
      "Up to 500 students",
      "All Core Modules & Fees",
      "Exam Marks & Grade Sheets",
      "Parent & Student Mobile Apps",
      "Priority WhatsApp Support",
    ],
    highlight: true,
    badge: "Most Popular",
  },
  {
    id: "pro",
    name: "Pro",
    price: "NPR 999",
    period: "/month",
    description: "Advanced multi-branch tools for large institutions.",
    features: [
      "Unlimited students & staff",
      "eSewa / Khalti Online Payments",
      "Custom Domain & Website Builder",
      "Biometric Attendance Integration",
      "Dedicated Account Manager",
    ],
    highlight: false,
    badge: "Enterprise",
  },
];

// ─── NEPAL DISTRICTS ──────────────────────────────────────────────────────────
const NEPAL_DISTRICTS = [
  "Kathmandu", "Lalitpur", "Bhaktapur", "Kaski", "Morang", "Rupandehi", "Chitwan",
  "Jhapa", "Sunsari", "Dhanusha", "Parsa", "Kavrepalanchok", "Makwanpur", "Gorkha",
  "Tanahun", "Syngja", "Palpa", "Nawalparasi", "Dang", "Banke", "Surkhet", "Kailali",
  "Kanchanpur", "Ilam", "Dhankuta", "Siraha", "Saptari", "Mahottari", "Sarlahi", "Rautahat",
  "Bara", "Sindhuli", "Ramechhap", "Dolakha", "Sindhupalchok", "Nuwakot", "Rasuwa",
  "Dhading", "Lamjung", "Manang", "Mustang", "Myagdi", "Parbat", "Baglung", "Gulmi",
  "Arghakhanchi", "Kapilvastu", "Pyuthan", "Rolpa", "Rukum", "Salyan", "Jajarkot",
  "Dailekh", "Dolpa", "Jumla", "Kalikot", "Mugu", "Humla", "Bajura", "Bajhang",
  "Achham", "Doti", "Darchula", "Baitadi", "Dadeldhura",
].sort();

// ─── FORM SCHEMAS ─────────────────────────────────────────────────────────────
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
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type SchoolInfoForm = z.infer<typeof schoolInfoSchema>;
type AdminForm = z.infer<typeof adminSchema>;

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = [
    { num: 1, label: "Choose Plan", icon: Sparkles },
    { num: 2, label: "School Details", icon: Building2 },
    { num: 3, label: "Admin Account", icon: User },
  ];

  return (
    <div className="flex items-center justify-between max-w-lg mx-auto mb-8 px-2">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
                i + 1 < step
                  ? "bg-primary text-primary-foreground"
                  : i + 1 === step
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1 < step ? "✓" : s.num}
            </div>
            <p className={`text-[11px] mt-1.5 font-bold tracking-tight ${i + 1 === step ? "text-primary" : "text-muted-foreground"}`}>
              {s.label}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-1 flex-1 mx-3 -mt-4 rounded-full transition-all ${i + 1 < step ? "bg-primary" : "bg-muted"}`} />
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
    <div className="space-y-6">
      <div className="text-center max-w-md mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold font-sora text-foreground">Select the Perfect Plan</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Start with Free or unlock full school automation with Starter.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <div
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className={`relative rounded-2xl border-2 p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-lg scale-[1.02]"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sun text-ink text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-sm">
                  {plan.badge}
                </span>
              )}

              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg text-foreground font-sora">{plan.name}</h3>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border-2 border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && "✓"}
                  </div>
                </div>

                <div className="mb-3">
                  <span className="text-2xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-xs text-muted-foreground ml-1">{plan.period}</span>
                </div>

                <p className="text-xs text-muted-foreground mb-4 min-h-[32px]">{plan.description}</p>

                <div className="space-y-2 border-t border-border/80 pt-3">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-xs text-foreground/90">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3">
                <Button
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className="w-full text-xs font-bold rounded-xl h-9"
                  onClick={() => {
                    onSelect(plan.id);
                    onNext();
                  }}
                >
                  {isSelected ? "Continue with " + plan.name : "Select " + plan.name}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={onNext}
          className="h-11 px-8 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-2"
        >
          Next: School Details <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 2: SCHOOL DETAILS ──────────────────────────────────────────────────
function SchoolInfoStep({
  form,
  onNext,
  onBack,
}: {
  form: ReturnType<typeof useForm<SchoolInfoForm>>;
  onNext: () => void;
  onBack: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div className="text-center max-w-md mx-auto mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-sora text-foreground">Tell Us About Your School</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          This sets up your institutional profile and school portal.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="school_name" className="text-xs font-bold">
            School / College Name *
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="school_name"
              placeholder="e.g. Kathmandu Model Secondary School"
              className="pl-10 h-11 rounded-xl text-sm"
              {...register("school_name")}
            />
          </div>
          {errors.school_name && (
            <p className="text-xs text-destructive mt-1">{errors.school_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="district" className="text-xs font-bold">
            District *
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              id="district"
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("district")}
            >
              <option value="">Select District</option>
              {NEPAL_DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {errors.district && (
            <p className="text-xs text-destructive mt-1">{errors.district.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="municipality" className="text-xs font-bold">
            Municipality / Local Body *
          </Label>
          <Input
            id="municipality"
            placeholder="e.g. Pokhara Metropolitan City"
            className="h-11 rounded-xl text-sm"
            {...register("municipality")}
          />
          {errors.municipality && (
            <p className="text-xs text-destructive mt-1">{errors.municipality.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type" className="text-xs font-bold">
            School Type *
          </Label>
          <select
            id="type"
            className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register("type")}
          >
            <option value="private">Private / Institutional</option>
            <option value="public">Government / Public</option>
            <option value="community">Community / Trust</option>
          </select>
          {errors.type && (
            <p className="text-xs text-destructive mt-1">{errors.type.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="level" className="text-xs font-bold">
            School Level *
          </Label>
          <select
            id="level"
            className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register("level")}
          >
            <option value="higher_secondary">Higher Secondary (+2 / College)</option>
            <option value="secondary">Secondary (Class 1-10)</option>
            <option value="lower_secondary">Lower Secondary (Class 1-8)</option>
            <option value="primary">Primary (Class 1-5 / Montessori)</option>
          </select>
          {errors.level && (
            <p className="text-xs text-destructive mt-1">{errors.level.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-11 px-6 rounded-xl font-bold gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Plans
        </Button>
        <Button
          type="submit"
          className="h-11 px-8 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-2"
        >
          Next: Admin Setup <ArrowRight className="w-4 h-4" />
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
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-5">
      <div className="text-center max-w-md mx-auto mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-sora text-foreground">Create Principal / Admin Account</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          This account will be the primary superadmin of your school system.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="name" className="text-xs font-bold">
            Full Name *
          </Label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="name"
              placeholder="e.g. Bishal Regmi"
              className="pl-10 h-11 rounded-xl text-sm"
              {...register("name")}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin_email" className="text-xs font-bold">
            Work Email *
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="admin_email"
              type="email"
              placeholder="principal@yourschool.edu.np"
              className="pl-10 h-11 rounded-xl text-sm"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-bold">
            Nepal Phone Number *
          </Label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              placeholder="98XXXXXXXX"
              maxLength={10}
              className="pl-10 h-11 rounded-xl text-sm font-medium tracking-wider"
              {...register("phone")}
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin_password" className="text-xs font-bold">
            Password *
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="admin_password"
              type="password"
              placeholder="••••••••"
              className="pl-10 h-11 rounded-xl text-sm"
              {...register("password")}
            />
          </div>
          {errors.password && (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="text-xs font-bold">
            Confirm Password *
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="confirm_password"
              type="password"
              placeholder="••••••••"
              className="pl-10 h-11 rounded-xl text-sm"
              {...register("confirm_password")}
            />
          </div>
          {errors.confirm_password && (
            <p className="text-xs text-destructive mt-1">{errors.confirm_password.message}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl p-3 bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2 mt-4">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>Instant activation: You will be logged into your dashboard immediately upon registration.</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-11 px-6 rounded-xl font-bold gap-2"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4" /> Back to School Info
        </Button>
        <Button
          type="submit"
          className="h-11 px-8 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-2"
          disabled={loading}
        >
          {loading ? <Spinner size="sm" /> : "Complete Registration & Launch"}
        </Button>
      </div>
    </div>
  );
}

// ─── MAIN REGISTER COMPONENT ──────────────────────────────────────────────────
function RegisterPageContent() {
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam && ["free", "starter", "pro"].includes(planParam)) {
      setSelectedPlan(planParam);
    }
  }, [searchParams]);

  const schoolForm = useForm<SchoolInfoForm>({
    resolver: zodResolver(schoolInfoSchema),
    defaultValues: {
      school_name: "",
      district: "",
      municipality: "",
      type: "private",
      level: "secondary",
    },
  });

  const adminForm = useForm<AdminForm>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirm_password: "",
    },
  });

  const onSubmit = adminForm.handleSubmit(async (adminData) => {
    const schoolData = schoolForm.getValues();
    setLoading(true);

    try {
      // Shared client: relative /api/v1 (same-origin rewrite) + cookie session.
      await api.post("/auth/register", {
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
      });

      toast.success("🎉 School registered successfully! Welcome to ASchool.");
      // Instantly direct to dashboard with cookies set
      window.location.href = "/dashboard";
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-black/5 bg-card p-6 sm:p-10">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-border">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center text-primary-foreground font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
            AS
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight block leading-none font-sora">
              A<span className="text-sun">S</span>chool
            </span>
            <span className="text-[9px] text-muted-foreground tracking-widest uppercase font-medium">
              School Setup
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground hidden sm:inline">Already registered?</span>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-bold text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10 transition-colors"
          >
            Sign In <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

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

      {/* Footer Trust Notes */}
      <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground text-center sm:text-left">
        <span>🇳🇵 Built specially for Nepalese Schools & Colleges</span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" /> 256-Bit SSL Encrypted • Zero Data Loss Guarantee
        </span>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-sm text-muted-foreground"><Spinner size="lg" /></div>}>
      <RegisterPageContent />
    </Suspense>
  );
}