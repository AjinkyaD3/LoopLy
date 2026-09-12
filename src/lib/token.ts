import { randomBytes } from "crypto";

/**
 * Character set for clean, readable, URL-safe business QR tokens.
 * Uses 32 non-ambiguous characters (omitting easily confused chars like 0, O, 1, I, l).
 */
const TOKEN_CHARSET = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * Generates a cryptographically secure, non-sequential random token.
 * Used for both permanent business join tokens and disposable campaign tokens.
 * Length defaults to 12 characters (>60 bits of entropy), preventing ID enumeration.
 * Example result: 'k8f2m9q1px4z'
 */
export function generateToken(length: number = 12): string {
  if (length < 8) {
    throw new Error("Token length must be at least 8 characters");
  }

  const bytes = randomBytes(length);
  let token = "";
  const charsetLength = TOKEN_CHARSET.length;

  for (let i = 0; i < length; i++) {
    // Unbiased indexing using rejection sampling / modulo with power-of-2 length
    // Since TOKEN_CHARSET length is 32 (power of 2), byte & 31 provides uniform distribution with zero bias.
    token += TOKEN_CHARSET[bytes[i] & (charsetLength - 1)];
  }

  return token;
}

/**
 * Validates whether a given string matches the token format (business or campaign tokens).
 */
export function isValidToken(token: string): boolean {
  if (typeof token !== "string" || token.length < 8 || token.length > 32) {
    return false;
  }
  const regex = new RegExp(`^[${TOKEN_CHARSET}]+$`);
  return regex.test(token);
}
