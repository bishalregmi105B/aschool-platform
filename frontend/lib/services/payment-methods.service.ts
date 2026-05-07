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

export const FALLBACK_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    key: "cash",
    label: "Cash",
    enabled: true,
    mode: "offline",
    requires_reference: false,
    supports_qr: false,
    qr_image_url: "",
    qr_payload: "",
    instructions: "",
  },
  {
    key: "bank",
    label: "Bank Transfer",
    enabled: true,
    mode: "offline",
    requires_reference: true,
    supports_qr: true,
    qr_image_url: "",
    qr_payload: "",
    instructions: "",
  },
  {
    key: "cheque",
    label: "Cheque",
    enabled: true,
    mode: "offline",
    requires_reference: true,
    supports_qr: false,
    qr_image_url: "",
    qr_payload: "",
    instructions: "",
  },
  {
    key: "fonepay",
    label: "FonePay",
    enabled: true,
    mode: "offline",
    requires_reference: true,
    supports_qr: true,
    qr_image_url: "",
    qr_payload: "",
    instructions: "",
  },
  {
    key: "esewa",
    label: "eSewa",
    enabled: true,
    mode: "online",
    requires_reference: false,
    supports_qr: true,
    qr_image_url: "",
    qr_payload: "",
    instructions: "",
  },
  {
    key: "khalti",
    label: "Khalti",
    enabled: true,
    mode: "online",
    requires_reference: false,
    supports_qr: true,
    qr_image_url: "",
    qr_payload: "",
    instructions: "",
  },
];

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
