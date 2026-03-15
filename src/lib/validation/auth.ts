import { z } from "zod";

/** Username: 3–32 chars, alphanumeric and underscore only */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(32, "Username must be at most 32 characters.")
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscore.");

/** Name or surname: 1–100 chars */
export const namePartSchema = z
  .string()
  .trim()
  .min(1, "Required (1–100 characters).")
  .max(100, "Must be at most 100 characters.");

/** PIN: exactly 4 digits */
export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits.");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  pin: pinSchema,
});

export const registerSchema = z.object({
  name: namePartSchema,
  surname: namePartSchema,
  username: usernameSchema,
  pin: pinSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Username: 3–32 chars, alphanumeric and underscore only */
export function isValidUsername(username: string): boolean {
  return usernameSchema.safeParse(username.trim()).success;
}

export function isValidNamePart(value: string): boolean {
  return namePartSchema.safeParse(value.trim()).success;
}

export function isValidPinFormat(pin: string): boolean {
  return pinSchema.safeParse(pin).success;
}

export function validateRegister(
  input: Record<string, string>
): { ok: true } | { ok: false; error: string } {
  const result = registerSchema.safeParse({
    name: input.name?.trim() ?? "",
    surname: input.surname?.trim() ?? "",
    username: input.username?.trim() ?? "",
    pin: input.pin ?? "",
  });
  if (result.success) return { ok: true };
  const first = result.error.flatten().fieldErrors;
  const msg =
    first.name?.[0] ?? first.surname?.[0] ?? first.username?.[0] ?? first.pin?.[0] ?? "Invalid input.";
  return { ok: false, error: msg };
}

export function validateLogin(
  input: Record<string, string>
): { ok: true } | { ok: false; error: string } {
  const result = loginSchema.safeParse({
    username: input.username?.trim() ?? "",
    pin: input.pin ?? "",
  });
  if (result.success) return { ok: true };
  const first = result.error.flatten().fieldErrors;
  const msg = first.username?.[0] ?? first.pin?.[0] ?? "Invalid input.";
  return { ok: false, error: msg };
}
