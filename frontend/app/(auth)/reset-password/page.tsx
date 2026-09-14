"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ArrowLeft,
} from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Token-less visits (from "Forgot password?" on /login) first request a
  // reset link; the backend reports delivery honestly ("sent" only when the
  // email actually went out, "unavailable" when SMTP is not configured).
  const [email, setEmail] = useState("");
  const [delivery, setDelivery] = useState<string | null>(null);

  const handleRequestLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setDelivery(null);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setDelivery(res.data?.data?.delivery ?? "unknown");
      toast.success(res.data?.data?.message || "Reset request received");
    } catch (err: unknown) {
      const msg =
        err instanceof Error && "response" in err
          ? ((err.response as { data?: { error?: string } })?.data?.error ?? "Failed to request a reset link")
          : "Failed to request a reset link";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      toast.error("Reset link is missing its token — request a new one.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      toast.error("Use 8+ characters with upper & lowercase letters and a number");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
      toast.success("Password reset successfully — sign in with the new password");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && "response" in err
          ? ((err.response as { data?: { error?: string } })?.data?.error ?? "Invalid or expired reset link")
          : "Invalid or expired reset link";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl shadow-2xl border border-black/5 bg-card p-8 sm:p-10 auth-accent">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
      </Link>

      <div className="mt-6 mb-8">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center mb-4">
          <KeyRound className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground font-sora">
          {done
            ? "Password Updated"
            : token
              ? "Choose a New Password"
              : "Reset Your Password"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {done
            ? "Your password has been changed. All previous sessions were signed out."
            : token
              ? "Enter the new password for your account. Reset links expire after 30 minutes and can only be used once."
              : "Enter your account email and we will start a password reset for you."}
        </p>
      </div>

      {done ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-mint/10 text-sm text-mint font-medium">
            <CheckCircle2 className="w-4 h-4" /> You can sign in now.
          </div>
          <Button
            onClick={() => router.push("/login")}
            className="w-full h-11 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
          >
            Go to Sign In
          </Button>
        </div>
      ) : !token ? (
        <form onSubmit={handleRequestLink} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold">
              Account Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@yourschool.edu.np"
                className="pl-10 h-11 rounded-xl text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {delivery && delivery !== "sent" && (
            <div className="p-3 rounded-xl bg-muted text-xs text-muted-foreground">
              {delivery === "unavailable"
                ? "Email delivery is currently unavailable. Your school administrator can hand you a reset token — ask them to check the server logs."
                : "If that email belongs to an active account, a password reset has been initiated."}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : "Send Reset Link"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-bold">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Min 8 chars, 1 upper, 1 lower, 1 digit"
                className="pl-10 h-11 rounded-xl text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-xs font-bold">
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat the new password"
                className="pl-10 h-11 rounded-xl text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {confirm && confirm !== password && (
              <p className="text-xs text-destructive" role="alert">Passwords don&apos;t match yet.</p>
            )}
            {confirm && confirm === password && (
              <p className="text-xs text-[#107c10]">Matches.</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all mt-2"
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : "Reset Password"}
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * PasswordStrength — live meter + upfront criteria checklist.
 *
 * Research notes: usable-password guidance converges on (1) show the rules
 * BEFORE the user types, not as a post-error, (2) real-time feedback while
 * typing, (3) never block paste. The score mirrors the backend policy
 * (8+ chars, upper+lower+digit) with a "strong" bonus tier at 12+.
 */
function scorePassword(pw: string): { score: 0 | 1 | 2 | 3; label: string; color: string } {
  const checks =
    (pw.length >= 8 ? 1 : 0) +
    (/[a-z]/.test(pw) && /[A-Z]/.test(pw) ? 1 : 0) +
    (/\d/.test(pw) ? 1 : 0);
  const bonus = pw.length >= 12 && checks === 3;
  if (!pw) return { score: 0, label: "", color: "transparent" };
  if (checks < 2) return { score: 1, label: "Weak", color: "#c42b1c" };
  if (checks === 2 || !bonus) return { score: 2, label: "Okay", color: "#eaa300" };
  return { score: 3, label: "Strong", color: "#107c10" };
}

function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = scorePassword(password);
  const criteria = [
    { ok: password.length >= 8, text: "8+ characters" },
    { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), text: "Upper & lowercase letters" },
    { ok: /\d/.test(password), text: "A number" },
  ];
  return (
    <div className="space-y-1.5 pt-1" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1" role="presentation">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="flex-1 rounded-full transition-colors"
              style={{ backgroundColor: i <= score ? color : "rgba(0,0,0,0.1)" }}
            />
          ))}
        </div>
        {label && <span className="text-[11px] font-bold" style={{ color }}>{label}</span>}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {criteria.map((c) => (
          <li key={c.text} className={c.ok ? "text-[#107c10]" : undefined}>
            {c.ok ? "✓" : "○"} {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-3xl shadow-2xl border border-black/5 bg-card p-10 grid place-items-center">
          <Spinner />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
