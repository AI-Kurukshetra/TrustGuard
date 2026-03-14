import {
  Alert,
  DashboardMetric,
  Device,
  FraudCase,
  RiskRule,
  Transaction,
  User
} from "@/lib/types";

export const dashboardMetrics: DashboardMetric[] = [
  { label: "Transactions / min", value: "1,284", delta: "+8.4%", tone: "positive" },
  { label: "Fraud Prevented", value: "$248K", delta: "+12.1%", tone: "positive" },
  { label: "False Positive Rate", value: "1.8%", delta: "-0.4%", tone: "positive" },
  { label: "Scoring Latency", value: "132ms", delta: "+11ms", tone: "warning" }
];

export const users: User[] = [
  {
    id: "usr_1001",
    email: "maya@neobank.io",
    riskScore: 22,
    createdAt: "2026-03-01T09:20:00Z",
    region: "US-West",
    velocity24h: 6
  },
  {
    id: "usr_1002",
    email: "arjun@checkoutlab.co",
    riskScore: 76,
    createdAt: "2026-02-18T11:40:00Z",
    region: "US-East",
    velocity24h: 18
  },
  {
    id: "usr_1003",
    email: "ops@walletpilot.app",
    riskScore: 91,
    createdAt: "2026-03-11T04:12:00Z",
    region: "EU-Central",
    velocity24h: 31
  }
];

export const devices: Device[] = [
  {
    id: "dev_2001",
    userId: "usr_1001",
    deviceHash: "fp_a8bz90",
    browser: "Chrome 134",
    os: "macOS",
    ipAddress: "34.219.28.17",
    trustScore: 88,
    lastSeenAt: "2026-03-14T06:40:00Z"
  },
  {
    id: "dev_2002",
    userId: "usr_1002",
    deviceHash: "fp_n1xq73",
    browser: "Safari 18",
    os: "iOS",
    ipAddress: "44.231.90.10",
    trustScore: 46,
    lastSeenAt: "2026-03-14T06:43:00Z"
  },
  {
    id: "dev_2003",
    userId: "usr_1003",
    deviceHash: "fp_k2rm15",
    browser: "Chrome 134",
    os: "Windows 11",
    ipAddress: "91.198.174.192",
    trustScore: 19,
    lastSeenAt: "2026-03-14T06:47:00Z"
  }
];

export const transactions: Transaction[] = [
  {
    id: "txn_3001",
    userId: "usr_1001",
    amount: 128.42,
    currency: "USD",
    status: "approved",
    riskScore: 18,
    createdAt: "2026-03-14T06:41:00Z",
    location: "Seattle, US",
    deviceHash: "fp_a8bz90",
    channel: "Card",
    reason: "Trusted device, stable velocity"
  },
  {
    id: "txn_3002",
    userId: "usr_1002",
    amount: 1622.11,
    currency: "USD",
    status: "review",
    riskScore: 73,
    createdAt: "2026-03-14T06:44:00Z",
    location: "New York, US",
    deviceHash: "fp_n1xq73",
    channel: "Wallet",
    reason: "New device and amount spike over baseline"
  },
  {
    id: "txn_3003",
    userId: "usr_1003",
    amount: 2480.99,
    currency: "EUR",
    status: "blocked",
    riskScore: 96,
    createdAt: "2026-03-14T06:46:00Z",
    location: "Berlin, DE",
    deviceHash: "fp_k2rm15",
    channel: "Bank Transfer",
    reason: "Impossible travel plus rapid retry pattern"
  },
  {
    id: "txn_3004",
    userId: "usr_1002",
    amount: 87.21,
    currency: "USD",
    status: "review",
    riskScore: 67,
    createdAt: "2026-03-14T06:48:00Z",
    location: "Boston, US",
    deviceHash: "fp_n1xq73",
    channel: "Card",
    reason: "Card testing sequence detected"
  }
];

export const fraudCases: FraudCase[] = [
  {
    id: "case_4001",
    transactionId: "txn_3002",
    status: "open",
    analystNotes: "Verify KYC refresh and merchant history before release.",
    owner: "A. Patel",
    createdAt: "2026-03-14T06:45:00Z"
  },
  {
    id: "case_4002",
    transactionId: "txn_3003",
    status: "escalated",
    analystNotes: "Account takeover indicators present. Notify customer success.",
    owner: "S. Kim",
    createdAt: "2026-03-14T06:47:00Z"
  }
];

export const alerts: Alert[] = [
  {
    id: "alt_5001",
    alertType: "Impossible Travel",
    severity: "critical",
    entityId: "usr_1003",
    createdAt: "2026-03-14T06:47:00Z",
    summary: "Login observed in Warsaw 11 minutes after Berlin device registration."
  },
  {
    id: "alt_5002",
    alertType: "Velocity Burst",
    severity: "high",
    entityId: "usr_1002",
    createdAt: "2026-03-14T06:44:00Z",
    summary: "15 payment attempts across 3 cards within 6 minutes."
  },
  {
    id: "alt_5003",
    alertType: "Trusted Entity Override",
    severity: "low",
    entityId: "usr_1001",
    createdAt: "2026-03-14T06:41:00Z",
    summary: "Whitelist rule lowered score after consistent device match."
  }
];

export const riskRules: RiskRule[] = [
  {
    id: "rule_6001",
    ruleName: "High Amount + New Device",
    condition: "transaction_amount > 1500 AND device_is_new = true",
    action: "review",
    active: true,
    hitRate: 14
  },
  {
    id: "rule_6002",
    ruleName: "Impossible Travel Block",
    condition: "travel_speed_kmh > 900 AND login_gap_minutes < 45",
    action: "block",
    active: true,
    hitRate: 4
  },
  {
    id: "rule_6003",
    ruleName: "VIP Whitelist",
    condition: "user_in_whitelist = true AND device_trust_score > 80",
    action: "approve",
    active: true,
    hitRate: 22
  }
];

export function getUserById(id: string) {
  return users.find((user) => user.id === id) ?? null;
}

export function getTransactionsForUser(userId: string) {
  return transactions.filter((transaction) => transaction.userId === userId);
}

export function getRiskProfile(userId: string) {
  const user = getUserById(userId);
  if (!user) {
    return null;
  }

  const userTransactions = getTransactionsForUser(userId);
  const userDevice = devices.find((device) => device.userId === userId) ?? null;
  const userAlerts = alerts.filter((alert) => alert.entityId === userId);

  return {
    user,
    device: userDevice,
    transactions: userTransactions,
    alerts: userAlerts,
    recommendation:
      user.riskScore >= 85 ? "Block and escalate" : user.riskScore >= 60 ? "Manual review" : "Approve"
  };
}
