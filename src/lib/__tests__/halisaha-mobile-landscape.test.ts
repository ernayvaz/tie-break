import { describe, expect, it } from "vitest";
import { isHalisahaPhoneLikeViewport } from "@/lib/halisaha/mobile-landscape";

describe("halisaha/mobile-landscape", () => {
  it("treats phone-sized portrait viewports as mobile even without touch signals", () => {
    expect(
      isHalisahaPhoneLikeViewport({
        viewportWidth: 375,
        viewportHeight: 667,
        hasCoarsePointer: false,
        maxTouchPoints: 0,
      }),
    ).toBe(true);
  });

  it("treats coarse-pointer landscape phones as mobile", () => {
    expect(
      isHalisahaPhoneLikeViewport({
        viewportWidth: 844,
        viewportHeight: 390,
        hasCoarsePointer: true,
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("keeps tablet-sized viewports out of the forced mobile landscape flow", () => {
    expect(
      isHalisahaPhoneLikeViewport({
        viewportWidth: 768,
        viewportHeight: 1024,
        hasCoarsePointer: true,
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });

  it("does not treat small desktop windows as mobile without touch signals", () => {
    expect(
      isHalisahaPhoneLikeViewport({
        viewportWidth: 500,
        viewportHeight: 800,
        hasCoarsePointer: false,
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
