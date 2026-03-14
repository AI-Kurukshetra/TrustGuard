import { describe, expect, it } from "vitest";
import { __internal, validatePaymentMethod } from "@/lib/payment-validation";

describe("payment validation adapters", () => {
  it("validates a strong card payload", () => {
    const result = validatePaymentMethod({
      method_type: "card",
      fingerprint: "fp_card_123",
      last4: "4242",
      expiry_month: 12,
      expiry_year: 2099,
      card_number: "4242424242424242"
    });

    expect(result.validated).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.adapter).toBe("card_v1");
  });

  it("rejects invalid card payloads", () => {
    const result = validatePaymentMethod({
      method_type: "card",
      fingerprint: "",
      last4: "12",
      expiry_month: 1,
      expiry_year: 2020,
      card_number: "1234567890123456"
    });

    expect(result.validated).toBe(false);
    expect(result.reasons).toContain("missing_fingerprint");
    expect(result.reasons).toContain("invalid_last4");
    expect(result.reasons).toContain("luhn_failed");
  });

  it("flags risky bank payloads", () => {
    const result = validatePaymentMethod({
      method_type: "bank_account",
      provider: "",
      fingerprint: "",
      bank_account_token: ""
    });

    expect(result.validated).toBe(false);
    expect(result.adapter).toBe("bank_v1");
    expect(result.reasons).toContain("missing_bank_identifier");
  });
});

describe("luhn helper", () => {
  it("returns true for valid numbers and false otherwise", () => {
    expect(__internal.luhnValid("4242424242424242")).toBe(true);
    expect(__internal.luhnValid("4000000000000001")).toBe(false);
  });
});
