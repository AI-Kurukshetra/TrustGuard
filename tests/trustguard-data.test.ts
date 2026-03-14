import { describe, expect, it } from "vitest";
import { __internal } from "@/lib/trustguard-data";

describe("rule condition evaluator", () => {
  it("matches AND expressions", () => {
    const matched = __internal.evaluateRuleCondition(
      "transaction_amount > 1500 AND device_is_new = true",
      {
        transaction_amount: 1622.11,
        device_is_new: true
      }
    );

    expect(matched).toBe(true);
  });

  it("supports OR expressions", () => {
    const matched = __internal.evaluateRuleCondition("geo_mismatch = true OR velocity_count >= 5", {
      geo_mismatch: false,
      velocity_count: 8
    });

    expect(matched).toBe(true);
  });
});

describe("heuristic risk scoring", () => {
  it("adds impossible-travel and failed-login risk", () => {
    const result = __internal.calculateHeuristicRisk({
      amount: 2200,
      isNewDevice: true,
      velocity1h: 7,
      geoMismatch: true,
      travelSpeedKmh: 1200,
      loginGapMinutes: 9,
      failedLoginCount: 5,
      chargebackHistoryCount: 3,
      paymentMethodValidated: false
    });

    expect(result.normalizedScore).toBe(100);
    expect(result.explanation).toContain("impossible_travel");
    expect(result.explanation).toContain("failed_login_burst");
    expect(result.explanation).toContain("chargeback_history");
  });
});
