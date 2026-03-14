type MethodType = "card" | "bank_account" | "wallet" | "crypto_wallet" | string;

export type PaymentValidationInput = {
  method_type?: MethodType;
  provider?: string | null;
  fingerprint?: string | null;
  last4?: string | null;
  expiry_month?: number | null;
  expiry_year?: number | null;
  card_number?: string | null;
  bank_account_token?: string | null;
  wallet_id?: string | null;
  billing_country?: string | null;
};

export type PaymentValidationResult = {
  validated: boolean;
  source: string;
  score: number;
  reasons: string[];
  adapter: "card_v1" | "bank_v1" | "wallet_v1" | "generic_v1";
};

function isDigitsOnly(value: string) {
  return /^[0-9]+$/.test(value);
}

function luhnValid(cardNumber: string) {
  if (!isDigitsOnly(cardNumber)) {
    return false;
  }

  let sum = 0;
  let doubleDigit = false;
  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    let digit = Number(cardNumber[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

function computeCardValidation(input: PaymentValidationInput): PaymentValidationResult {
  let score = 100;
  const reasons: string[] = [];

  const fingerprint = typeof input.fingerprint === "string" ? input.fingerprint.trim() : "";
  const last4 = typeof input.last4 === "string" ? input.last4.trim() : "";
  const cardNumber = typeof input.card_number === "string" ? input.card_number.replace(/\s+/g, "") : "";

  if (!fingerprint) {
    score -= 40;
    reasons.push("missing_fingerprint");
  }

  if (last4.length !== 4 || !isDigitsOnly(last4)) {
    score -= 30;
    reasons.push("invalid_last4");
  }

  const expiryMonth = typeof input.expiry_month === "number" ? input.expiry_month : null;
  const expiryYear = typeof input.expiry_year === "number" ? input.expiry_year : null;
  if (expiryMonth !== null && expiryYear !== null) {
    if (expiryMonth < 1 || expiryMonth > 12) {
      score -= 25;
      reasons.push("invalid_expiry_month");
    } else {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1;
      if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
        score -= 35;
        reasons.push("card_expired");
      }
    }
  } else {
    score -= 10;
    reasons.push("missing_expiry");
  }

  if (cardNumber) {
    if (!luhnValid(cardNumber)) {
      score -= 40;
      reasons.push("luhn_failed");
    } else {
      reasons.push("luhn_passed");
    }
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    validated: normalizedScore >= 60,
    source: "rules_adapter_v2",
    score: normalizedScore,
    reasons,
    adapter: "card_v1"
  };
}

function computeBankValidation(input: PaymentValidationInput): PaymentValidationResult {
  let score = 100;
  const reasons: string[] = [];

  const fingerprint = typeof input.fingerprint === "string" ? input.fingerprint.trim() : "";
  const bankToken =
    typeof input.bank_account_token === "string" ? input.bank_account_token.trim() : "";
  const last4 = typeof input.last4 === "string" ? input.last4.trim() : "";

  if (!fingerprint && !bankToken) {
    score -= 45;
    reasons.push("missing_bank_identifier");
  }

  if (last4 && (!isDigitsOnly(last4) || last4.length !== 4)) {
    score -= 25;
    reasons.push("invalid_last4");
  }

  if (!input.provider || String(input.provider).trim() === "") {
    score -= 15;
    reasons.push("missing_provider");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    validated: normalizedScore >= 60,
    source: "rules_adapter_v2",
    score: normalizedScore,
    reasons,
    adapter: "bank_v1"
  };
}

function computeWalletValidation(input: PaymentValidationInput): PaymentValidationResult {
  let score = 100;
  const reasons: string[] = [];

  const fingerprint = typeof input.fingerprint === "string" ? input.fingerprint.trim() : "";
  const walletId = typeof input.wallet_id === "string" ? input.wallet_id.trim() : "";

  if (!walletId) {
    score -= 35;
    reasons.push("missing_wallet_id");
  }

  if (!fingerprint) {
    score -= 20;
    reasons.push("missing_fingerprint");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    validated: normalizedScore >= 60,
    source: "rules_adapter_v2",
    score: normalizedScore,
    reasons,
    adapter: "wallet_v1"
  };
}

function computeGenericValidation(input: PaymentValidationInput): PaymentValidationResult {
  let score = 100;
  const reasons: string[] = [];
  if (!input.method_type || String(input.method_type).trim() === "") {
    score -= 50;
    reasons.push("missing_method_type");
  }
  if (!input.fingerprint || String(input.fingerprint).trim() === "") {
    score -= 30;
    reasons.push("missing_fingerprint");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    validated: normalizedScore >= 60,
    source: "rules_adapter_v2",
    score: normalizedScore,
    reasons,
    adapter: "generic_v1"
  };
}

export function validatePaymentMethod(input: PaymentValidationInput): PaymentValidationResult {
  const methodType = typeof input.method_type === "string" ? input.method_type : "";
  if (methodType === "card") {
    return computeCardValidation(input);
  }
  if (methodType === "bank_account") {
    return computeBankValidation(input);
  }
  if (methodType === "wallet" || methodType === "crypto_wallet") {
    return computeWalletValidation(input);
  }
  return computeGenericValidation(input);
}

export const __internal = {
  luhnValid
};
