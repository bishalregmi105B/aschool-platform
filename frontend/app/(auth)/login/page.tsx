"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

const phoneSchema = z.object({
  phone: z.string().regex(/^(98|97|96)\d{8}$/, "Valid Nepal phone number required (98/97/96XXXXXXXX)"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const passwordSchema = z.object({
  email: z.string().min(3, "Valid email or phone required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginMode = "password" | "otp";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("password");
  const [otpSent, setOtpSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, login, loginWithOtp, sendOtp } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

  const handleSendOtp = async (data: z.infer<typeof phoneSchema>) => {
    setLoading(true);
    try {
      await sendOtp(data.phone);
      setPhone(data.phone);
      setOtpSent(true);
      toast.success("OTP sent to your phone");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (data: z.infer<typeof otpSchema>) => {
    setLoading(true);
    try {
      await loginWithOtp(phone, data.otp);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (data: z.infer<typeof passwordSchema>) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-black/5 bg-card grid grid-cols-1 md:grid-cols-12 min-h-[600px] auth-accent">
      {/* ── Left Hero / Branding Panel (Desktop) ── */}
      <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-ocean via-ocean-light to-ocean text-white p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-mint/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-sun/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-2xl bg-white/15 backdrop-blur-md grid place-items-center text-white font-black text-lg shadow-sm border border-white/20 group-hover:scale-105 transition-transform">
              AS
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight block leading-none font-sora">
                A<span className="text-sun">S</span>chool
              </span>
              <span className="text-[10px] text-mint tracking-widest uppercase font-medium">
                School OS Nepal
              </span>
            </div>
          </Link>

          <div className="mt-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-mint backdrop-blur-sm border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-sun" />
              Modern School Management
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold font-sora leading-snug">
              Powering Modern Education in Nepal
            </h2>
            <p className="text-white/80 text-xs lg:text-sm leading-relaxed">
              Experience hassle-free administration, real-time fee collection, attendance tracking, and parent communication.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {[
              "Bikram Sambat (BS) & IEMIS-Ready",
              "eSewa, Khalti & Fonepay Integrated",
              "Automated Grade Sheets & Report Cards",
              "Parent, Teacher & Student Mobile Apps",
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-xs text-white/90">
                <div className="w-4 h-4 rounded-full bg-mint/20 flex items-center justify-center text-mint shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-mint" />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-white/70">
          <span>Trusted by 400+ Schools</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-mint" /> ISO 27001
          </span>
        </div>
      </div>

      {/* ── Right Login Form Panel ── */}
      <div className="col-span-1 md:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-white dark:bg-card">
        <div>
          {/* Top navigation */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Register School <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground font-sora">
              Sign In to Your School
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Enter your login credentials or sign in with your verified phone.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex p-1 bg-muted rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setOtpSent(false);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === "password"
                  ? "bg-white dark:bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email / Password
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("otp");
                setOtpSent(false);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === "otp"
                  ? "bg-white dark:bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Phone OTP
            </button>
          </div>

          {/* Password Form */}
          {mode === "password" ? (
            <form onSubmit={passwordForm.handleSubmit(handlePasswordLogin)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold">
                  Email or Phone
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="admin@yourschool.edu.np"
                    className="pl-10 h-11 rounded-xl text-sm"
                    {...passwordForm.register("email")}
                  />
                </div>
                {passwordForm.formState.errors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {passwordForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold">
                    Password
                  </Label>
                  <Link
                    href="/reset-password"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-11 rounded-xl text-sm"
                    {...passwordForm.register("password")}
                  />
                </div>
                {passwordForm.formState.errors.password && (
                  <p className="text-xs text-destructive mt-1">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all mt-2"
                disabled={loading}
              >
                {loading ? <Spinner size="sm" /> : "Sign In to Dashboard"}
              </Button>
            </form>
          ) : (
            /* OTP Form */
            !otpSent ? (
              <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold">
                    Nepal Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="98XXXXXXXX"
                      maxLength={10}
                      className="pl-10 h-11 rounded-xl text-sm tracking-wider font-medium"
                      {...phoneForm.register("phone")}
                    />
                  </div>
                  {phoneForm.formState.errors.phone && (
                    <p className="text-xs text-destructive mt-1">
                      {phoneForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
                  disabled={loading}
                >
                  {loading ? <Spinner size="sm" /> : "Send Verification Code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp" className="text-xs font-bold">
                    Enter 6-digit Code sent to {phone}
                  </Label>
                  <Input
                    id="otp"
                    placeholder="000000"
                    maxLength={6}
                    className="h-12 text-center text-2xl tracking-[0.5em] font-bold rounded-xl"
                    autoFocus
                    {...otpForm.register("otp")}
                  />
                  {otpForm.formState.errors.otp && (
                    <p className="text-xs text-destructive mt-1">
                      {otpForm.formState.errors.otp.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
                  disabled={loading}
                >
                  {loading ? <Spinner size="sm" /> : "Verify & Sign In"}
                </Button>
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                >
                  Change phone number
                </button>
              </form>
            )
          )}
        </div>

        {/* Bottom Callout Banner */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="rounded-2xl p-4 bg-muted/60 border border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground">Need a new school management account?</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Set up your school in 2 minutes with free starter features.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-sm transition-all"
            >
              Register Free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
