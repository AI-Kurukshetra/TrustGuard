type JsonObject = Record<string, unknown>;

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type TrustGuardDecision = "approve" | "review" | "block";

export type AnalyzeTransactionInput = {
  amount: number;
  currency: string;
  user_id: string;
  country_code?: string;
  device_id?: string;
  payment_method_id?: string;
  external_transaction_id?: string;
  channel?: string;
  payment_provider?: string;
  merchant_order_id?: string;
  ip_address?: string;
  latitude?: number;
  longitude?: number;
  raw_payload?: JsonObject;
} & JsonObject;

export type AnalyzeTransactionResult = {
  transaction_id: string;
  risk_score: number;
  decision: TrustGuardDecision;
  explanation: string[];
  matched_rules: string[];
  persisted: boolean;
  alert_id?: string;
  case_id?: string;
};

export type RegisterDeviceInput = {
  user_id: string;
  browser?: string;
  os?: string;
  screen_resolution?: string;
  ip_address?: string;
  hardware_signature?: string;
} & JsonObject;

export type RegisterDeviceResult = {
  user_id: string | null;
  device_hash: string;
  registered: boolean;
  trust_score: number;
  trust_risk_score: number;
  trust_signals: JsonObject;
};

export type ScorePaymentInput = {
  transaction: AnalyzeTransactionInput;
  device?: RegisterDeviceInput;
};

export type ScorePaymentResult = {
  analysis: AnalyzeTransactionResult;
  device?: RegisterDeviceResult;
};

export type TrustGuardJsAgentConfig = {
  baseUrl: string;
  apiKey: string;
  merchantId: string;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
};

export class TrustGuardJsAgentError extends Error {
  status?: number;
  code?: string;
  response?: unknown;
  cause?: unknown;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      response?: unknown;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "TrustGuardJsAgentError";
    this.status = options?.status;
    this.code = options?.code;
    this.response = options?.response;
    this.cause = options?.cause;
  }
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 2;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelayMs(attempt: number) {
  return 200 * 2 ** attempt;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function toErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim() !== "") {
    return payload.error;
  }
  return fallback;
}

function toErrorCode(payload: unknown) {
  if (isRecord(payload) && typeof payload.code === "string" && payload.code.trim() !== "") {
    return payload.code;
  }
  return undefined;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function buildDefaultFetch() {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Provide fetchImpl in TrustGuardJsAgentConfig.");
  }
  return fetch;
}

export class TrustGuardJsAgent {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly merchantId: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: TrustGuardJsAgentConfig) {
    if (!config.baseUrl || !config.apiKey || !config.merchantId) {
      throw new Error("baseUrl, apiKey, and merchantId are required.");
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.merchantId = config.merchantId;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.fetchImpl = config.fetchImpl ?? buildDefaultFetch();
  }

  async analyzeTransaction(input: AnalyzeTransactionInput) {
    return this.request<AnalyzeTransactionResult>("POST", "/api/transactions/analyze", input);
  }

  async registerDevice(input: RegisterDeviceInput) {
    return this.request<RegisterDeviceResult>("POST", "/api/devices/register", input);
  }

  async updateSessionBehavior(sessionId: string, behavioralBiometrics: JsonObject) {
    if (!sessionId) {
      throw new Error("sessionId is required.");
    }

    return this.request<{ data: { id: string; behavioral_biometrics: JsonObject; updated_at: string } }>(
      "PATCH",
      `/api/sessions/${encodeURIComponent(sessionId)}/behavior`,
      { behavioral_biometrics: behavioralBiometrics }
    );
  }

  async getAlerts() {
    return this.request<{ data: JsonObject[]; channels: string[] }>("GET", "/api/alerts");
  }

  async scorePayment(input: ScorePaymentInput): Promise<ScorePaymentResult> {
    if (!input.transaction) {
      throw new Error("transaction payload is required.");
    }

    let device: RegisterDeviceResult | undefined;
    const transactionPayload: AnalyzeTransactionInput = { ...input.transaction };

    if (input.device) {
      device = await this.registerDevice(input.device);
      const currentTrust = Number(transactionPayload.device_trust_score ?? 0);
      transactionPayload.device_trust_score = Math.max(currentTrust, Number(device.trust_score ?? 0));
    }

    const analysis = await this.analyzeTransaction(transactionPayload);
    return { analysis, device };
  }

  private async request<T>(method: RequestMethod, path: string, body?: JsonObject): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "x-merchant-id": this.merchantId
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        const payload = (await response.json().catch(() => null)) as unknown;
        if (response.ok) {
          return payload as T;
        }

        const error = new TrustGuardJsAgentError(
          toErrorMessage(payload, `TrustGuard request failed (${response.status}).`),
          {
            status: response.status,
            code: toErrorCode(payload),
            response: payload
          }
        );

        if (attempt < this.retries && isRetryableStatus(response.status)) {
          await delay(getBackoffDelayMs(attempt));
          continue;
        }

        throw error;
      } catch (error) {
        const isAbortError = error instanceof Error && error.name === "AbortError";
        const shouldRetryNetwork = attempt < this.retries && !(error instanceof TrustGuardJsAgentError);
        const shouldRetryAbort = attempt < this.retries && isAbortError;

        if (shouldRetryNetwork || shouldRetryAbort) {
          await delay(getBackoffDelayMs(attempt));
          continue;
        }

        if (error instanceof TrustGuardJsAgentError) {
          throw error;
        }

        throw new TrustGuardJsAgentError("Unable to reach TrustGuard API.", { cause: error });
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new TrustGuardJsAgentError("Request exhausted retries without a response.");
  }
}

export function createTrustGuardJsAgent(config: TrustGuardJsAgentConfig) {
  return new TrustGuardJsAgent(config);
}
