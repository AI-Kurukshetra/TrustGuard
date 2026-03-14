#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN="${TOKEN:-}"
MERCHANT_ID="${MERCHANT_ID:-}"
USER_ID="${USER_ID:-10000000-0000-0000-0000-000000000002}"
SESSION_ID="${SESSION_ID:-}"
RULE_ID="${RULE_ID:-}"
WEBHOOK_ID="${WEBHOOK_ID:-}"
FRAUD_PATTERN_ID="${FRAUD_PATTERN_ID:-}"
RUN_ID="${RUN_ID:-$(date +%s)}"

if [[ -z "$TOKEN" || -z "$MERCHANT_ID" ]]; then
  echo "Missing required env vars."
  echo "Required: TOKEN, MERCHANT_ID"
  echo "Optional: BASE_URL, USER_ID, SESSION_ID, RULE_ID, WEBHOOK_ID, FRAUD_PATTERN_ID"
  exit 1
fi

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local url="${BASE_URL}${path}"
  local status

  if [[ -n "$data" ]]; then
    status=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-merchant-id: $MERCHANT_ID" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    status=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-merchant-id: $MERCHANT_ID")
  fi

  echo "[$method] $path -> $status"
  cat "$TMP_BODY"
  echo
  if [[ "$status" -ge 400 ]]; then
    echo "Request failed: $method $path"
    exit 1
  fi
}

echo "Running TrustGuard smoke suite against ${BASE_URL}"

request "GET" "/api/auth/me"
request "GET" "/api/alerts"
request "GET" "/api/rules"
request "GET" "/api/models"
request "GET" "/api/webhooks"
request "GET" "/api/compliance/reports"
request "GET" "/api/fraud-patterns"
request "GET" "/api/behavioral-patterns"
request "GET" "/api/geographical-locations"
request "GET" "/api/users/${USER_ID}/risk-profile"

request "POST" "/api/transactions/analyze" "$(cat <<JSON
{"amount":1622.11,"currency":"USD","user_id":"${USER_ID}","country_code":"US"}
JSON
)"

request "POST" "/api/devices/register" "$(cat <<JSON
{"user_id":"${USER_ID}","browser":"Chrome","os":"macOS","screen_resolution":"1728x1117","ip_address":"34.219.28.17","hardware_signature":"sig_smoke_test_${RUN_ID}"}
JSON
)"

request "POST" "/api/geographical-locations" "{\"country_code\":\"US\",\"region\":\"CA\",\"city\":\"San Francisco ${RUN_ID}\",\"timezone\":\"America/Los_Angeles\",\"risk_level\":\"low\"}"
if [[ -n "$SESSION_ID" ]]; then
  request "POST" "/api/behavioral-patterns" "{\"user_id\":\"${USER_ID}\",\"session_id\":\"${SESSION_ID}\",\"pattern_type\":\"typing_cadence\",\"score\":74.2,\"status\":\"observed\",\"pattern_payload\":{\"keystroke_variance\":0.19}}"
else
  request "POST" "/api/behavioral-patterns" "{\"user_id\":\"${USER_ID}\",\"pattern_type\":\"typing_cadence\",\"score\":74.2,\"status\":\"observed\",\"pattern_payload\":{\"keystroke_variance\":0.19}}"
fi
request "POST" "/api/fraud-patterns" "{\"pattern_name\":\"Rapid Card Testing Cluster ${RUN_ID}\",\"category\":\"payment_fraud\",\"severity\":\"high\",\"detection_type\":\"rule\",\"confidence\":82.5}"

if [[ -n "$RULE_ID" ]]; then
  request "PATCH" "/api/rules/${RULE_ID}" '{"active":false}'
fi

if [[ -n "$WEBHOOK_ID" ]]; then
  request "PATCH" "/api/webhooks/${WEBHOOK_ID}" '{"active":false}'
fi

if [[ -n "$FRAUD_PATTERN_ID" ]]; then
  request "PATCH" "/api/fraud-patterns/${FRAUD_PATTERN_ID}" '{"active":false}'
fi

echo "Smoke suite completed."
