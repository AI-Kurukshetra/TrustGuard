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
      paymentMethodValidated: false,
      identityVerified: false,
      deviceTrustScore: 10,
      behavioralAnomalyScore: 85
    });

    expect(result.normalizedScore).toBe(100);
    expect(result.explanation).toContain("impossible_travel");
    expect(result.explanation).toContain("failed_login_burst");
    expect(result.explanation).toContain("chargeback_history");
    expect(result.explanation).toContain("ato_compound_signal");
    expect(result.explanation).toContain("behavioral_anomaly_high");
    expect(result.explanation).toContain("low_device_trust");
    expect(result.explanation).toContain("identity_unverified");
  });
});

describe("device trust profile", () => {
  it("assigns high trust to stable known devices", () => {
    const result = __internal.buildDeviceTrustProfile({
      isKnownDevice: true,
      linkedToDifferentUser: false,
      hasHardwareSignature: true,
      hasIpAddress: true,
      accountDeviceCount: 2,
      approvedTransactionCount90d: 12,
      failedLoginEvents24h: 0,
      daysSinceFirstSeen: 90,
      daysSinceLastSeen: 1
    });

    expect(result.trustScore).toBeGreaterThanOrEqual(70);
    expect(result.riskScore).toBeLessThanOrEqual(30);
  });

  it("assigns low trust to novel cross-user devices with failed logins", () => {
    const result = __internal.buildDeviceTrustProfile({
      isKnownDevice: false,
      linkedToDifferentUser: true,
      hasHardwareSignature: false,
      hasIpAddress: false,
      accountDeviceCount: 8,
      approvedTransactionCount90d: 0,
      failedLoginEvents24h: 8,
      daysSinceFirstSeen: 0,
      daysSinceLastSeen: 120
    });

    expect(result.trustScore).toBeLessThanOrEqual(30);
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
  });
});

describe("model deployment assignment", () => {
  it("routes to challenger when bucket falls under traffic split", () => {
    const result = __internal.selectDeployedModel({
      activeModelId: "model-active",
      challengerModelId: "model-challenger",
      challengerTrafficPercent: 100,
      seed: "seed-user-1"
    });

    expect(result.variant).toBe("challenger");
    expect(result.modelId).toBe("model-challenger");
  });

  it("routes to active when challenger traffic is zero", () => {
    const result = __internal.selectDeployedModel({
      activeModelId: "model-active",
      challengerModelId: "model-challenger",
      challengerTrafficPercent: 0,
      seed: "seed-user-2"
    });

    expect(result.variant).toBe("active");
    expect(result.modelId).toBe("model-active");
  });
});
