"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const phoneSchema = z.object({
  phone: z.string().regex(/^(98|97|96)\d{8}$/, "Valid Nepal phone number required"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const passwordSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginMode = "otp" | "password";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("otp");
  const [otpSent, setOtpSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, loginWithOtp, sendOtp } = useAuth();

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
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2">
          A
        </div>
        <CardTitle className="text-2xl">Welcome to ASchool</CardTitle>
        <CardDescription>
          {mode === "otp"
            ? "Sign in with your phone number"
            : "Sign in with email and password"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {mode === "otp" ? (
          !otpSent ? (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="98XXXXXXXX"
                  {...phoneForm.register("phone")}
                  maxLength={10}
                />
                {phoneForm.formState.errors.phone && (
                  <p className="text-sm text-destructive">{phoneForm.formState.errors.phone.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Spinner size="sm" /> : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP sent to {phone}</Label>
                <Input
                  id="otp"
                  placeholder="000000"
                  {...otpForm.register("otp")}
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em]"
                />
                {otpForm.formState.errors.otp && (
                  <p className="text-sm text-destructive">{otpForm.formState.errors.otp.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Spinner size="sm" /> : "Verify & Login"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setOtpSent(false)}
              >
                Change number
              </Button>
            </form>
          )
        ) : (
          <form onSubmit={passwordForm.handleSubmit(handlePasswordLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@school.edu.np"
                {...passwordForm.register("email")}
              />
              {passwordForm.formState.errors.email && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...passwordForm.register("password")}
              />
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : "Sign In"}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => {
              setMode(mode === "otp" ? "password" : "otp");
              setOtpSent(false);
            }}
          >
            {mode === "otp" ? "Use email & password instead" : "Use phone OTP instead"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
