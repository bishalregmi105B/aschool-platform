import { api, type ApiResponse } from "@/lib/api";

export type PaymentMethodKey =
  | "cash"
  | "bank"
  | "cheque"
  | "fonepay"
  | "esewa"
  | "khalti";

export interface PaymentMethodConfig {
  key: PaymentMethodKey;
  label: string;
  enabled: boolean;
  mode: "online" | "offline";
  requires_reference: boolean;
  supports_qr: boolean;
  qr_image_url?: string;
  qr_payload?: string;
  instructions?: string;
  /** Gateway merchant/product code (eSewa product code, FonePay PID). */
  merchant_code?: string;
  /**
   * Gateway secret key — write-only. The API returns "***" when a key is set
   * and "" when none is configured. Submitting "***" preserves the existing key.
   */
  secret_key?: string;
}

export interface PaymentMethodsResponse {
  methods: PaymentMethodConfig[];
  enabled_methods: PaymentMethodKey[];
  online_methods: PaymentMethodKey[];
}

export const EMPTY_PAYMENT_METHODS_RESPONSE: PaymentMethodsResponse = {
  methods: [],
  enabled_methods: [],
  online_methods: [],
};

export function normalizePaymentMethodsResponse(
  data?: Partial<PaymentMethodsResponse> | null,
): PaymentMethodsResponse {
  const methods = Array.isArray(data?.methods) ? data.methods : [];
  const enabledMethods = Array.isArray(data?.enabled_methods)
    ? data.enabled_methods
    : methods.filter((item) => item.enabled).map((item) => item.key);
  const onlineMethods = Array.isArray(data?.online_methods)
    ? data.online_methods
    : methods
        .filter((item) => item.enabled && item.mode === "online")
        .map((item) => item.key);

  return {
    methods,
    enabled_methods: enabledMethods,
    online_methods: onlineMethods,
  };
}

export async function fetchPaymentMethods(): Promise<PaymentMethodsResponse> {
  const response = await api.get<ApiResponse<PaymentMethodsResponse>>(
    "/fees/payment-methods",
  );
  return normalizePaymentMethodsResponse(response.data.data);
}

export async function updatePaymentMethods(
  methods: PaymentMethodConfig[],
): Promise<PaymentMethodsResponse> {
  const response = await api.put<ApiResponse<PaymentMethodsResponse>>(
    "/fees/payment-methods",
    { methods },
  );
  return response.data.data;
}
