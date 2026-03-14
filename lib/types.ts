export type TransactionStatus = "approved" | "review" | "blocked";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type CaseStatus = "open" | "escalated" | "resolved";
export type RuleAction = "approve" | "review" | "block";

export interface User {
  id: string;
  email: string;
  riskScore: number;
  createdAt: string;
  region: string;
  velocity24h: number;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  riskScore: number;
  createdAt: string;
  location: string;
  deviceHash: string;
  channel: string;
  reason: string;
}

export interface Device {
  id: string;
  userId: string;
  deviceHash: string;
  browser: string;
  os: string;
  ipAddress: string;
  trustScore: number;
  lastSeenAt: string;
}

export interface FraudCase {
  id: string;
  transactionId: string;
  status: CaseStatus;
  analystNotes: string;
  owner: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  alertType: string;
  severity: AlertSeverity;
  entityId: string;
  createdAt: string;
  summary: string;
}

export interface RiskRule {
  id: string;
  ruleName: string;
  condition: string;
  action: RuleAction;
  active: boolean;
  hitRate: number;
}

export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  tone: "neutral" | "positive" | "warning";
}

export interface KpiSummary {
  falsePositiveRatePct: number;
  falseNegativeRatePct: number;
  estimatedPrecisionPct: number;
  estimatedRecallPct: number;
  transactionLatencyMsAvg: number;
  transactionLatencyMsP95: number;
  apiUptimePct: number;
  revenueProtectedAmount: number;
  complianceAuditSuccessRatePct: number;
  modelDriftSignal: "stable" | "attention" | "insufficient_data";
}
