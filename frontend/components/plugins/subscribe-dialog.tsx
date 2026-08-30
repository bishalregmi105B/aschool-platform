"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  fetchPaymentMethods,
  type PaymentMethodConfig,
} from "@/lib/services/payment-methods.service";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";

/**
 * SubscribeDialog — collects the payment proof the backend requires
 * (POST /plugins/<slug>/subscribe returns 402 without
 * {"payment": {"provider", "transaction_id"}} — audit E5). Manual/offline
 * payment flows record the provider transaction reference here; Stripe
 * webhook activations remain the automated path.
 */
export function SubscribeDialog({
  plugin,
  open,
  onOpenChange,
  onSubscribed,
}: {
  plugin: { slug: string; name: string; price_monthly: number; price_yearly: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribed?: () => void;
}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [provider, setProvider] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { data: methodData } = useQuery({
    queryKey: ["subscribe-payment-methods"],
    queryFn: async () => {
      try {
        return await fetchPaymentMethods();
      } catch {
        return EMPTY_PAYMENT_METHODS_RESPONSE;
      }
    },
    enabled: open,
  });
  const methods: PaymentMethodConfig[] =
    methodData?.methods.filter((m) => m.enabled) || [];

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/plugins/${plugin!.slug}/subscribe`, {
        billing_cycle: billingCycle,
        payment: { provider, transaction_id: transactionId.trim() },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(`${plugin!.name} subscription activated`);
      setError(null);
      setTransactionId("");
      onOpenChange(false);
      onSubscribed?.();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data
              ?.error ?? "Subscription failed")
          : "Subscription failed";
      setError(typeof msg === "string" ? msg : "Subscription failed");
    },
  });

  const price =
    plugin === null
      ? 0
      : billingCycle === "yearly"
        ? plugin.price_yearly
        : plugin.price_monthly;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to {plugin?.name}</DialogTitle>
          <DialogDescription>
            Record your payment to activate the subscription.{" "}
            {plugin && (
              <>
                {formatCurrency(price)} for {billingCycle === "yearly" ? "a year" : "a month"}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Billing cycle</Label>
            <Select
              value={billingCycle}
              onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Payment provider</Label>
            {methods.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No payment methods configured (set them up under Settings →
                Integrations). You can still record an offline payment below.
              </p>
            ) : (
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Transaction reference</Label>
            <Input
              placeholder="e.g. eSewa ref no. / bank voucher no."
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The subscription activates only with a transaction reference —
              it is recorded as the payment proof for this install.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              mutation.isPending || !provider || transactionId.trim().length === 0
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size="sm" /> : "Activate Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
