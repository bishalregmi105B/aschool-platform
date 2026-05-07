"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VerifyOtpContent />
    </Suspense>
  );
}

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Please enter 6-digit OTP"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Invalid OTP"); return; }
      toast.success("Phone verified successfully!");
      router.push("/login");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        toast.success("OTP resent");
        setResendTimer(60);
      } else {
        toast.error("Failed to resend OTP");
      }
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <Card className="shadow-lg max-w-sm mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2">A</div>
        <CardTitle className="text-2xl">Verify Phone</CardTitle>
        <CardDescription>Enter the 6-digit OTP sent to {phone || "your phone"}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">OTP Code</Label>
            <Input
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
            {loading ? <Spinner size="sm" /> : "Verify"}
          </Button>

          <div className="text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-muted-foreground">Resend OTP in {resendTimer}s</p>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={handleResend}>Resend OTP</Button>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            <a href="/login" className="text-primary hover:underline">Back to login</a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
