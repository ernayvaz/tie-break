import { describe, expect, it } from "vitest";
import { HALISAHA_ADMIN_PREVIEW_ONLY, canAccessHalisahaMode } from "@/lib/halisaha/public-access";

describe("halisaha/public-access", () => {
  it("keeps admin access enabled during preview", () => {
    expect(HALISAHA_ADMIN_PREVIEW_ONLY).toBe(true);
    expect(canAccessHalisahaMode("admin")).toBe(true);
  });

  it("blocks non-admin access during preview", () => {
    expect(canAccessHalisahaMode("user")).toBe(false);
    expect(canAccessHalisahaMode(undefined)).toBe(false);
  });
});
