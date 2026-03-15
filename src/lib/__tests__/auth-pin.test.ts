import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, isValidPinFormat } from "@/lib/auth/pin";

describe("auth/pin", () => {
  describe("isValidPinFormat", () => {
    it("accepts exactly 4 digits", () => {
      expect(isValidPinFormat("1234")).toBe(true);
      expect(isValidPinFormat("0000")).toBe(true);
      expect(isValidPinFormat("9999")).toBe(true);
    });
    it("rejects non-4-digit strings", () => {
      expect(isValidPinFormat("")).toBe(false);
      expect(isValidPinFormat("123")).toBe(false);
      expect(isValidPinFormat("12345")).toBe(false);
      expect(isValidPinFormat("12a4")).toBe(false);
      expect(isValidPinFormat("abcd")).toBe(false);
      expect(isValidPinFormat(" 1234")).toBe(false);
      expect(isValidPinFormat("1234 ")).toBe(false);
    });
  });

  describe("hashPin", () => {
    it("returns a non-empty string different from input", async () => {
      const hashed = await hashPin("1234");
      expect(hashed).toBeTruthy();
      expect(hashed).not.toBe("1234");
      expect(hashed.length).toBeGreaterThan(4);
    });
    it("produces different hashes for same PIN (salt)", async () => {
      const a = await hashPin("1234");
      const b = await hashPin("1234");
      expect(a).not.toBe(b);
    });
  });

  describe("verifyPin", () => {
    it("returns true when plain PIN matches hash", async () => {
      const pin = "5678";
      const hashed = await hashPin(pin);
      const ok = await verifyPin(pin, hashed);
      expect(ok).toBe(true);
    });
    it("returns false when plain PIN does not match hash", async () => {
      const hashed = await hashPin("1234");
      expect(await verifyPin("0000", hashed)).toBe(false);
      expect(await verifyPin("1235", hashed)).toBe(false);
    });
  });
});
