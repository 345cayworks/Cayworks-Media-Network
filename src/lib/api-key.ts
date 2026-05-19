import { createHash, randomBytes } from "crypto";

const PREFIX = "cae_live_";

/**
 * Generate a new platform API key. The raw key is shown to the operator
 * exactly once; only its SHA-256 hash and a short visible prefix are stored.
 */
export function generateApiKey(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const secret = randomBytes(24).toString("base64url");
  const raw = `${PREFIX}${secret}`;
  return {
    raw,
    hash: hashApiKey(raw),
    // First 12 chars give operators a non-secret way to identify the key.
    prefix: raw.slice(0, 12),
  };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/** Constant-time-ish comparison via hashing both sides. */
export function apiKeyMatches(raw: string, storedHash: string): boolean {
  if (!raw || !storedHash) return false;
  return hashApiKey(raw) === storedHash;
}
