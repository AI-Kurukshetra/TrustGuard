import { createHash, randomBytes } from "crypto";

export const API_KEY_PREFIX = "tg_live_";

export function generateApiKey() {
  const secret = randomBytes(24).toString("base64url");
  const apiKey = `${API_KEY_PREFIX}${secret}`;
  return {
    apiKey,
    keyHash: hashApiKey(apiKey),
    keyPrefix: apiKey.slice(0, 16)
  };
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function maskApiKeyPrefix(prefix: string) {
  return `${prefix}********`;
}
