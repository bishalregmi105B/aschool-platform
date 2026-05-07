import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  normalizePaymentMethodsResponse,
} from "@/lib/services/payment-methods.service";

describe("normalizePaymentMethodsResponse", () => {
  it("keeps an empty backend payload empty instead of restoring fallback methods", () => {
    expect(normalizePaymentMethodsResponse(null)).toEqual(
      EMPTY_PAYMENT_METHODS_RESPONSE,
    );
  });

  it("derives enabled and online lists from the returned methods when needed", () => {
    const response = normalizePaymentMethodsResponse({
      methods: [
        {
          key: "cash",
          label: "Cash Counter",
          enabled: true,
          mode: "offline",
          requires_reference: false,
          supports_qr: false,
        },
        {
          key: "khalti",
          label: "Khalti QR",
          enabled: true,
          mode: "online",
          requires_reference: false,
          supports_qr: true,
        },
      ],
    });

    expect(response.enabled_methods).toEqual(["cash", "khalti"]);
    expect(response.online_methods).toEqual(["khalti"]);
  });
});