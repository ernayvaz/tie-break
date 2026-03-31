import { describe, expect, it } from "vitest";
import {
  isHalisahaPhoneLikeViewport,
  isLikelyHalisahaPhoneUserAgent,
  shouldUseHalisahaMobileMatchdayPager,
} from "@/lib/halisaha/mobile-landscape";

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

  it("enables the mobile pager for phone-sized matchday tabs without requiring landscape", () => {
    expect(
      shouldUseHalisahaMobileMatchdayPager({
        isPhoneLikeViewport: true,
        isMatchdayTab: true,
      }),
    ).toBe(true);

    expect(
      shouldUseHalisahaMobileMatchdayPager({
        isPhoneLikeViewport: true,
        isMatchdayTab: false,
      }),
    ).toBe(false);

    expect(
      shouldUseHalisahaMobileMatchdayPager({
        isPhoneLikeViewport: false,
        isMatchdayTab: true,
      }),
    ).toBe(false);
  });

  it("detects phone user agents for a stable first mobile render", () => {
    expect(
      isLikelyHalisahaPhoneUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);

    expect(
      isLikelyHalisahaPhoneUserAgent(
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(true);

    expect(
      isLikelyHalisahaPhoneUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);

    expect(
      isLikelyHalisahaPhoneUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });
});
