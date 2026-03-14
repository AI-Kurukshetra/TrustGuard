import { describe, expect, it } from "vitest";
import { BILLING_PLAN_DEFINITIONS, __billingInternal } from "@/lib/billing";

describe("billing plan definitions", () => {
  it("keeps starter advanced features disabled", () => {
    const starter = BILLING_PLAN_DEFINITIONS.starter;
    expect(starter.features.advanced_detection_suite).toBe(false);
    expect(starter.monthlyTransactionLimit).toBeGreaterThan(0);
  });

  it("enables enterprise-only features", () => {
    const enterprise = BILLING_PLAN_DEFINITIONS.enterprise;
    expect(enterprise.features.cross_merchant_intelligence).toBe(true);
    expect(enterprise.features.quantum_crypto).toBe(true);
    expect(enterprise.monthlyTransactionLimit).toBeNull();
  });
});

describe("billing helpers", () => {
  it("normalizes unknown plans to starter", () => {
    expect(__billingInternal.toPlanTier("unknown")).toBe("starter");
    expect(__billingInternal.toPlanTier("growth")).toBe("growth");
  });

  it("returns positive integer overrides only", () => {
    expect(__billingInternal.toPositiveInteger(1200)).toBe(1200);
    expect(__billingInternal.toPositiveInteger(-1)).toBeNull();
    expect(__billingInternal.toPositiveInteger("abc")).toBeNull();
  });

  it("builds stable monthly period keys", () => {
    const window = __billingInternal.monthWindow(new Date("2026-03-14T00:00:00.000Z"));
    expect(window.periodKey).toBe("2026-03");
    expect(window.startIso.startsWith("2026-03-01")).toBe(true);
  });
});
