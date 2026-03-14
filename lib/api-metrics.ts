import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { hasSupabaseEnv } from "@/lib/supabase/config";

type RequestScopedClient = ReturnType<typeof createSupabaseRequestClient>;

interface ApiMetricInput {
  merchantId: string;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  client: RequestScopedClient | null;
}

export async function recordApiRequestMetric(input: ApiMetricInput) {
  if (!hasSupabaseEnv() || !input.client) {
    return;
  }

  const safeDuration = Number.isFinite(input.durationMs)
    ? Math.max(0, Math.round(input.durationMs))
    : 0;

  try {
    await input.client.from("api_request_metrics").insert({
      merchant_id: input.merchantId,
      route: input.route,
      method: input.method.toUpperCase(),
      status_code: input.statusCode,
      duration_ms: safeDuration,
      error_code: input.errorCode ?? null,
      metadata: input.metadata ?? {}
    });
  } catch {
    // Metrics writes are best-effort; never fail the API response.
  }
}
