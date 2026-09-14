"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { OtpInput } from "@/components/portal/otp-input";
import { api } from "@/lib/api";

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
  const devOtp = searchParams.get("dev_otp") || "";
  const [otp, setOtp] = useState(devOtp);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleVerify = async (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    if (otp.length !== 6) { toast.error("Please enter 6-digit OTP"); return; }
    setLoading(true);
    try {
      // Shared client: relative /api/v1 (same-origin rewrite) + cookie session.
      await api.post("/auth/verify-otp", { phone, otp });
      toast.success("Phone verified successfully!");
      router.push("/login");
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: string } } })?.response;
      toast.error(resp?.data?.error || (resp ? "Invalid OTP" : "Network error. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await api.post<{ data?: { otp?: string } | null }>("/auth/send-otp", { phone });
      const newDevOtp = res.data.data?.otp;
      toast.success(newDevOtp ? `OTP resent — Dev OTP: ${newDevOtp}` : "OTP resent");
      setResendTimer(60);
      if (newDevOtp) setOtp(newDevOtp);
    } catch {
      toast.error("Failed to resend OTP");
    }
  };

  return (
    <Card className="shadow-lg max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2">A</div>
        <CardTitle className="text-2xl">Verify Phone</CardTitle>
        <CardDescription>
          {phone
            ? "Enter the 6-digit OTP sent to " + phone
            : "This link is missing your phone number — start the sign-up again."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!phone ? (
          <Button variant="outline" className="w-full h-11" onClick={() => router.push("/register")}>
            Go to Register
          </Button>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            {devOtp && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                <strong>Dev mode:</strong> OTP is <span className="font-mono font-bold">{devOtp}</span> (pre-filled)
              </div>
            )}
            <div className="space-y-2">
              <Label>OTP Code</Label>
              <div className="flex justify-center">
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={() => void handleVerify()}
                  label="6-digit OTP code"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading || otp.length !== 6}>
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
        )}
      </CardContent>
    </Card>
  );
}
