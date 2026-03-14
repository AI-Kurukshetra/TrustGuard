import { describe, expect, it } from "vitest";
import {
  buildExplainabilityFactors,
  computeDynamicThresholds,
  detectAdversarialSignals,
  planAutoMlCandidates,
  scoreMultimodalRisk
} from "@/lib/advanced-intelligence";

describe("advanced intelligence helpers", () => {
  it("detects suspicious adversarial payload traits", () => {
    const detection = detectAdversarialSignals({
      amount: 1110,
      user_agent: "curl/8.0 bot",
      suspicious__field: "x",
      payload: "X".repeat(5000)
    });

    expect(detection.attackScore).toBeGreaterThanOrEqual(40);
    expect(detection.vectors.length).toBeGreaterThan(0);
  });

  it("scores multimodal risk and exposes dominant modalities", () => {
    const result = scoreMultimodalRisk({
      textRisk: 70,
      imageRisk: 15,
      voiceRisk: 25,
      behaviorRisk: 82
    });

    expect(result.combinedScore).toBeGreaterThanOrEqual(50);
    expect(result.dominantModalities).toContain("behavior");
  });

  it("computes adaptive thresholds from fraud pressure", () => {
    const thresholds = computeDynamicThresholds({
      avgRiskScore: 72,
      blockRatePct: 0.5,
      chargebackRatePct: 2.1,
      falsePositiveRatePct: 8,
      currentReviewThreshold: 60,
      currentBlockThreshold: 85
    });

    expect(thresholds.reviewThreshold).toBeLessThanOrEqual(60);
    expect(thresholds.blockThreshold).toBeGreaterThan(thresholds.reviewThreshold);
  });

  it("builds explainability factors from score + feature snapshot", () => {
    const factors = buildExplainabilityFactors({
      riskScore: 88,
      featureSnapshot: {
        amount: 2200,
        failed_login_count: 6,
        behavioral_anomaly_score: 78,
        adversarial_attack_score: 65
      },
      reasons: ["impossible_travel", "identity_unverified"]
    });

    expect(factors.length).toBeGreaterThan(0);
    expect(factors[0]?.contribution ?? 0).toBeGreaterThan(0);
  });

  it("selects a best automl candidate based on transaction outcomes", () => {
    const output = planAutoMlCandidates({
      runName: "nightly",
      transactions: [
        { risk_score: 92, status: "blocked" },
        { risk_score: 81, status: "review" },
        { risk_score: 28, status: "approved" },
        { risk_score: 75, status: "blocked" },
        { risk_score: 61, status: "review" }
      ]
    });

    expect(output.evaluation.samples).toBe(5);
    expect(output.bestConfig.blockThreshold).toBeGreaterThan(output.bestConfig.reviewThreshold);
  });
});
