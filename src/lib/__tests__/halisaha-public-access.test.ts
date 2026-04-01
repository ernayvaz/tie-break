import { describe, expect, it } from "vitest";
import { HALISAHA_ADMIN_PREVIEW_ONLY, canAccessHalisahaMode } from "@/lib/halisaha/public-access";

describe("halisaha/public-access", () => {
  it("keeps admin access enabled", () => {
    expect(HALISAHA_ADMIN_PREVIEW_ONLY).toBe(false);
    expect(canAccessHalisahaMode("admin")).toBe(true);
  });

  it("allows non-admin access when preview mode is off", () => {
    expect(canAccessHalisahaMode("user")).toBe(true);
    expect(canAccessHalisahaMode(undefined)).toBe(false);
  });
});
