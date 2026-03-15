import { describe, it, expect } from "vitest";
import {
  validateLogin,
  validateRegister,
  isValidUsername,
  isValidNamePart,
  isValidPinFormat,
} from "@/lib/validation/auth";

describe("validation/auth", () => {
  describe("validateLogin", () => {
    it("accepts valid username and 4-digit PIN", () => {
      expect(validateLogin({ username: "john", pin: "1234" })).toEqual({ ok: true });
      expect(validateLogin({ username: "user_1", pin: "0000" })).toEqual({ ok: true });
    });
    it("rejects empty username", () => {
      const r = validateLogin({ username: "", pin: "1234" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("Username");
    });
    it("rejects invalid PIN (not 4 digits)", () => {
      expect(validateLogin({ username: "john", pin: "123" })).toEqual({
        ok: false,
        error: "PIN must be exactly 4 digits.",
      });
      expect(validateLogin({ username: "john", pin: "12345" })).toEqual({
        ok: false,
        error: "PIN must be exactly 4 digits.",
      });
      expect(validateLogin({ username: "john", pin: "12a4" })).toEqual({
        ok: false,
        error: "PIN must be exactly 4 digits.",
      });
    });
    it("trims username", () => {
      expect(validateLogin({ username: "  john  ", pin: "1234" })).toEqual({ ok: true });
    });
  });

  describe("validateRegister", () => {
    it("accepts valid name, surname, username, 4-digit PIN", () => {
      expect(
        validateRegister({
          name: "John",
          surname: "Doe",
          username: "johndoe",
          pin: "1234",
        })
      ).toEqual({ ok: true });
    });
    it("rejects short username", () => {
      const r = validateRegister({
        name: "John",
        surname: "Doe",
        username: "ab",
        pin: "1234",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("3");
    });
    it("rejects username with invalid characters", () => {
      const r = validateRegister({
        name: "John",
        surname: "Doe",
        username: "john-doe",
        pin: "1234",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/letters|numbers|underscore/i);
    });
    it("rejects empty name or surname", () => {
      expect(
        validateRegister({
          name: "",
          surname: "Doe",
          username: "johndoe",
          pin: "1234",
        })
      ).toEqual({ ok: false, error: "Required (1–100 characters)." });
      expect(
        validateRegister({
          name: "John",
          surname: "",
          username: "johndoe",
          pin: "1234",
        })
      ).toEqual({ ok: false, error: "Required (1–100 characters)." });
    });
    it("rejects invalid PIN", () => {
      expect(
        validateRegister({
          name: "John",
          surname: "Doe",
          username: "johndoe",
          pin: "12",
        })
      ).toEqual({ ok: false, error: "PIN must be exactly 4 digits." });
    });
  });

  describe("isValidUsername", () => {
    it("returns true for 3–32 alphanumeric and underscore", () => {
      expect(isValidUsername("abc")).toBe(true);
      expect(isValidUsername("user_1")).toBe(true);
      expect(isValidUsername("a".repeat(32))).toBe(true);
    });
    it("returns false for too short or invalid chars", () => {
      expect(isValidUsername("ab")).toBe(false);
      expect(isValidUsername("user-name")).toBe(false);
      expect(isValidUsername("a".repeat(33))).toBe(false);
    });
  });

  describe("isValidNamePart", () => {
    it("returns true for non-empty trimmed 1–100 chars", () => {
      expect(isValidNamePart("John")).toBe(true);
      expect(isValidNamePart("  Jane  ")).toBe(true);
    });
    it("returns false for empty or too long", () => {
      expect(isValidNamePart("")).toBe(false);
      expect(isValidNamePart("   ")).toBe(false);
      expect(isValidNamePart("a".repeat(101))).toBe(false);
    });
  });

  describe("isValidPinFormat (validation)", () => {
    it("returns true for exactly 4 digits", () => {
      expect(isValidPinFormat("1234")).toBe(true);
    });
    it("returns false otherwise", () => {
      expect(isValidPinFormat("123")).toBe(false);
      expect(isValidPinFormat("12345")).toBe(false);
      expect(isValidPinFormat("12a4")).toBe(false);
    });
  });
});
