import { hash, compare } from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hash a 4-digit PIN for storage. Never store plaintext PINs.
 */
export async function hashPin(pin: string): Promise<string> {
  return hash(pin, SALT_ROUNDS);
}

/**
 * Verify a plaintext PIN against a stored hash.
 */
export async function verifyPin(plainPin: string, pinHash: string): Promise<boolean> {
  return compare(plainPin, pinHash);
}

/**
 * Validate PIN format: exactly 4 numeric digits.
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
