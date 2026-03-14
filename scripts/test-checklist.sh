#!/usr/bin/env bash
set -euo pipefail

RUN_SMOKE="${RUN_SMOKE:-auto}"

run_step() {
  local label="$1"
  shift
  echo
  echo "==> ${label}"
  "$@"
}

run_step "Lint" npm run lint
run_step "Typecheck" npm run typecheck
run_step "Unit tests" npm run test

if [[ "$RUN_SMOKE" == "never" ]]; then
  echo
  echo "Skipping smoke tests (RUN_SMOKE=never)."
  exit 0
fi

if [[ "$RUN_SMOKE" == "always" ]]; then
  echo
  echo "Running smoke tests (RUN_SMOKE=always)."
  run_step "API smoke" bash scripts/smoke-test.sh
  exit 0
fi

if [[ -n "${TOKEN:-}" && -n "${MERCHANT_ID:-}" ]]; then
  echo
  echo "Running smoke tests (credentials found)."
  run_step "API smoke" bash scripts/smoke-test.sh
else
  echo
  echo "Skipping smoke tests (set TOKEN and MERCHANT_ID, or RUN_SMOKE=always)."
fi
