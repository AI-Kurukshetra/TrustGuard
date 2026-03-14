import { createHash } from "node:crypto";

export type ExplainabilityFactor = {
  feature: string;
  contribution: number;
  impact: "low" | "medium" | "high";
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return numericValue;
}

function textEntropy(value: string) {
  if (value.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function createSeededRandom(seed: string) {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function buildExplainabilityFactors(input: {
  riskScore: number;
  featureSnapshot?: Record<string, unknown>;
  reasons?: string[];
}): ExplainabilityFactor[] {
  const featureSnapshot = input.featureSnapshot ?? {};
  const reasonSet = new Set(input.reasons ?? []);
  const rawFactors: Array<{ feature: string; weight: number }> = [
    {
      feature: "amount",
      weight: Math.min(40, toFiniteNumber(featureSnapshot.amount) / 75)
    },
    {
      feature: "velocity_1h",
      weight: toFiniteNumber(featureSnapshot.velocity_count) * 3
    },
    {
      feature: "failed_login_count",
      weight: toFiniteNumber(featureSnapshot.failed_login_count) * 5
    },
    {
      feature: "behavioral_anomaly_score",
      weight: toFiniteNumber(featureSnapshot.behavioral_anomaly_score) * 0.35
    },
    {
      feature: "device_trust_score",
      weight: featureSnapshot.device_trust_score ? (100 - toFiniteNumber(featureSnapshot.device_trust_score)) * 0.28 : 0
    },
    {
      feature: "adversarial_attack_score",
      weight: toFiniteNumber(featureSnapshot.adversarial_attack_score) * 0.4
    },
    {
      feature: "multimodal_risk_score",
      weight: toFiniteNumber(featureSnapshot.multimodal_risk_score) * 0.3
    },
    {
      feature: "channel_risk_score",
      weight: toFiniteNumber(featureSnapshot.channel_risk_score) * 0.25
    }
  ];

  if (reasonSet.has("impossible_travel")) {
    rawFactors.push({ feature: "geolocation", weight: 18 });
  }
  if (reasonSet.has("blacklist_match")) {
    rawFactors.push({ feature: "entity_blacklist", weight: 30 });
  }
  if (reasonSet.has("identity_unverified")) {
    rawFactors.push({ feature: "identity_verification", weight: 12 });
  }

  const totalWeight = rawFactors.reduce((sum, factor) => sum + Math.max(0, factor.weight), 0);
  if (totalWeight <= 0) {
    return [];
  }

  return rawFactors
    .map((factor) => {
      const contribution = Number(((Math.max(0, factor.weight) / totalWeight) * input.riskScore).toFixed(2));
      const impact: ExplainabilityFactor["impact"] =
        contribution >= 20 ? "high" : contribution >= 8 ? "medium" : "low";
      return {
        feature: factor.feature,
        contribution,
        impact
      };
    })
    .filter((factor) => factor.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution);
}

export function detectAdversarialSignals(payload: Record<string, unknown>) {
  const vectors: string[] = [];
  let score = 0;

  const payloadJson = JSON.stringify(payload);
  const payloadLength = payloadJson.length;
  if (payloadLength > 4000) {
    score += 22;
    vectors.push("oversized_payload");
  }

  const entropy = textEntropy(payloadJson);
  if (entropy > 5.2) {
    score += 26;
    vectors.push("high_entropy_payload");
  }

  const repeatedFields = Object.keys(payload).filter((key) => key.includes("__") || key.includes("$"));
  if (repeatedFields.length > 0) {
    score += 18;
    vectors.push("suspicious_field_pattern");
  }

  const amount = toFiniteNumber(payload.amount, 0);
  if (amount > 0 && Number.isInteger(amount) && amount % 111 === 0) {
    score += 8;
    vectors.push("scripted_amount_pattern");
  }

  const userAgent = typeof payload.user_agent === "string" ? payload.user_agent.toLowerCase() : "";
  if (userAgent.includes("python") || userAgent.includes("curl") || userAgent.includes("bot")) {
    score += 18;
    vectors.push("automation_user_agent");
  }

  const verdict = score >= 70 ? "blocked" : score >= 40 ? "suspicious" : "benign";

  return {
    attackScore: clampScore(score),
    vectors,
    verdict,
    payloadHash: createHash("sha256").update(payloadJson).digest("hex")
  };
}

export function scoreMultimodalRisk(input: {
  textRisk?: number;
  imageRisk?: number;
  voiceRisk?: number;
  behaviorRisk?: number;
}) {
  type Modality = "behavior" | "text" | "image" | "voice";

  const textScore = clampScore(toFiniteNumber(input.textRisk, 0));
  const imageScore = clampScore(toFiniteNumber(input.imageRisk, 0));
  const voiceScore = clampScore(toFiniteNumber(input.voiceRisk, 0));
  const behaviorScore = clampScore(toFiniteNumber(input.behaviorRisk, 0));

  const combinedScore = clampScore(
    textScore * 0.25 + imageScore * 0.2 + voiceScore * 0.2 + behaviorScore * 0.35
  );

  const modalityScores: Array<readonly [Modality, number]> = [
    ["behavior", behaviorScore],
    ["text", textScore],
    ["image", imageScore],
    ["voice", voiceScore]
  ];

  const dominantModalities = modalityScores
    .filter((entry) => entry[1] >= 45)
    .sort((left, right) => right[1] - left[1])
    .map((entry) => entry[0]);

  return {
    textScore,
    imageScore,
    voiceScore,
    behaviorScore,
    combinedScore,
    dominantModalities
  };
}

export function computeDynamicThresholds(input: {
  avgRiskScore: number;
  blockRatePct: number;
  chargebackRatePct: number;
  falsePositiveRatePct: number;
  currentReviewThreshold: number;
  currentBlockThreshold: number;
}) {
  let reviewThreshold = Math.round(toFiniteNumber(input.currentReviewThreshold, 60));
  let blockThreshold = Math.round(toFiniteNumber(input.currentBlockThreshold, 85));
  const rationale: string[] = [];

  if (input.chargebackRatePct >= 1.5 || input.blockRatePct < 1) {
    reviewThreshold -= 4;
    blockThreshold -= 3;
    rationale.push("tightened_due_to_chargeback_or_low_block_rate");
  }

  if (input.falsePositiveRatePct >= 25) {
    reviewThreshold += 5;
    blockThreshold += 4;
    rationale.push("relaxed_due_to_false_positive_pressure");
  }

  if (input.avgRiskScore >= 70) {
    reviewThreshold -= 2;
    rationale.push("tightened_due_to_high_avg_risk");
  } else if (input.avgRiskScore <= 30) {
    reviewThreshold += 2;
    rationale.push("relaxed_due_to_low_avg_risk");
  }

  reviewThreshold = Math.max(35, Math.min(85, reviewThreshold));
  blockThreshold = Math.max(reviewThreshold + 8, Math.min(98, blockThreshold));

  return {
    reviewThreshold,
    blockThreshold,
    rationale
  };
}

export function generateSyntheticFraudSamples(input: {
  scenario: string;
  count: number;
  currency?: string;
  seed?: string;
}) {
  const count = Math.max(1, Math.min(500, Math.round(input.count)));
  const currency = input.currency ?? "USD";
  const random = createSeededRandom(input.seed ?? `${input.scenario}:${count}`);

  return Array.from({ length: count }).map((_, index) => {
    const riskBand = random();
    const highRisk = riskBand > 0.65;
    const amountBase = highRisk ? 800 + random() * 5200 : 20 + random() * 450;

    return {
      synthetic_id: `syn_${index + 1}`,
      scenario: input.scenario,
      amount: Number(amountBase.toFixed(2)),
      currency,
      channel: highRisk ? "api" : "web",
      geo_mismatch: highRisk ? random() > 0.35 : random() > 0.9,
      velocity_count: highRisk ? 4 + Math.floor(random() * 10) : 1 + Math.floor(random() * 3),
      failed_login_count: highRisk ? 2 + Math.floor(random() * 8) : Math.floor(random() * 2),
      behavioral_anomaly_score: highRisk ? 60 + Math.floor(random() * 40) : Math.floor(random() * 35),
      expected_label: highRisk ? "fraud" : "legit"
    };
  });
}

export function simulateFraudScenario(input: {
  scenarioName: string;
  baselineRiskScore: number;
  iterations: number;
}) {
  const iterations = Math.max(1, Math.min(200, Math.round(input.iterations)));
  const random = createSeededRandom(`${input.scenarioName}:${input.baselineRiskScore}:${iterations}`);

  let blockCount = 0;
  let reviewCount = 0;
  const scores: number[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const perturbation = (random() - 0.5) * 26;
    const simulatedScore = clampScore(input.baselineRiskScore + perturbation);
    scores.push(simulatedScore);

    if (simulatedScore >= 85) {
      blockCount += 1;
    } else if (simulatedScore >= 60) {
      reviewCount += 1;
    }
  }

  const avgScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;

  return {
    scenarioName: input.scenarioName,
    iterations,
    avgRiskScore: Number(avgScore.toFixed(2)),
    blockedRatePct: Number(((blockCount / iterations) * 100).toFixed(2)),
    reviewRatePct: Number(((reviewCount / iterations) * 100).toFixed(2)),
    sampleScores: scores.slice(0, 20)
  };
}

export function buildLedgerHash(input: {
  merchantId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  previousHash?: string | null;
}) {
  const canonical = JSON.stringify({
    merchant_id: input.merchantId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    payload: input.payload,
    previous_hash: input.previousHash ?? null
  });

  const recordHash = createHash("sha256").update(canonical).digest("hex");
  return { canonical, recordHash };
}

export function computeGraphRiskScore(input: {
  entityCount: number;
  connectionCount: number;
  highRiskNodeCount: number;
  avgEdgeWeight: number;
}) {
  const density = input.entityCount > 1 ? input.connectionCount / (input.entityCount * (input.entityCount - 1)) : 0;

  const score = clampScore(
    input.highRiskNodeCount * 12 +
      input.avgEdgeWeight * 18 +
      density * 45 +
      Math.min(20, input.connectionCount)
  );

  return {
    score,
    density: Number(density.toFixed(4))
  };
}

export function planAutoMlCandidates(input: {
  runName: string;
  transactions: Array<{ risk_score: number; status: string }>;
}) {
  const samples = input.transactions;
  if (samples.length === 0) {
    return {
      bestConfig: {
        riskBias: 1,
        blockThreshold: 85,
        reviewThreshold: 60
      },
      evaluation: {
        score: 0,
        blockedPrecision: 0,
        reviewCoverage: 0,
        samples: 0
      }
    };
  }

  const candidates = [
    { riskBias: 0.9, blockThreshold: 88, reviewThreshold: 64 },
    { riskBias: 1, blockThreshold: 85, reviewThreshold: 60 },
    { riskBias: 1.1, blockThreshold: 82, reviewThreshold: 56 }
  ];

  let bestCandidate = candidates[0];
  let bestScore = -1;
  let bestEvaluation = {
    score: 0,
    blockedPrecision: 0,
    reviewCoverage: 0,
    samples: samples.length
  };

  for (const candidate of candidates) {
    let blockedCorrect = 0;
    let blockedTotal = 0;
    let reviewTotal = 0;

    for (const transaction of samples) {
      const adjustedRisk = clampScore(Number(transaction.risk_score) * candidate.riskBias);
      const status = transaction.status;
      const isChargebackLike = status === "blocked" || status === "review";

      if (adjustedRisk >= candidate.blockThreshold) {
        blockedTotal += 1;
        if (isChargebackLike) {
          blockedCorrect += 1;
        }
      } else if (adjustedRisk >= candidate.reviewThreshold) {
        reviewTotal += 1;
      }
    }

    const blockedPrecision = blockedTotal > 0 ? blockedCorrect / blockedTotal : 0;
    const reviewCoverage = reviewTotal / samples.length;
    const candidateScore = blockedPrecision * 0.7 + reviewCoverage * 0.3;

    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestCandidate = candidate;
      bestEvaluation = {
        score: Number(candidateScore.toFixed(4)),
        blockedPrecision: Number((blockedPrecision * 100).toFixed(2)),
        reviewCoverage: Number((reviewCoverage * 100).toFixed(2)),
        samples: samples.length
      };
    }
  }

  return {
    bestConfig: bestCandidate,
    evaluation: bestEvaluation
  };
}
