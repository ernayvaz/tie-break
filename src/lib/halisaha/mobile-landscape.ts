export const HALISAHA_MOBILE_LANDSCAPE_MAX_LONG_SIDE_PX = 1100;
export const HALISAHA_MOBILE_LANDSCAPE_MAX_SHORT_SIDE_PX = 540;
export const HALISAHA_MOBILE_VIEWPORT_FALLBACK_LONG_SIDE_PX = 932;
export const HALISAHA_MOBILE_VIEWPORT_FALLBACK_SHORT_SIDE_PX = 430;

export function isHalisahaPhoneLikeViewport({
  viewportWidth,
  viewportHeight,
  hasCoarsePointer,
  maxTouchPoints,
}: {
  viewportWidth: number;
  viewportHeight: number;
  hasCoarsePointer: boolean;
  maxTouchPoints: number;
}) {
  const longestSide = Math.max(viewportWidth, viewportHeight);
  const shortestSide = Math.min(viewportWidth, viewportHeight);
  const matchesPhoneSizedViewportFallback =
    longestSide <= HALISAHA_MOBILE_VIEWPORT_FALLBACK_LONG_SIDE_PX &&
    shortestSide <= HALISAHA_MOBILE_VIEWPORT_FALLBACK_SHORT_SIDE_PX;

  return (
    longestSide <= HALISAHA_MOBILE_LANDSCAPE_MAX_LONG_SIDE_PX &&
    shortestSide <= HALISAHA_MOBILE_LANDSCAPE_MAX_SHORT_SIDE_PX &&
    (hasCoarsePointer || maxTouchPoints > 0 || matchesPhoneSizedViewportFallback)
  );
}

export function shouldUseHalisahaMobileMatchdayPager({
  isPhoneLikeViewport,
  isMatchdayTab,
}: {
  isPhoneLikeViewport: boolean;
  isMatchdayTab: boolean;
}) {
  return isPhoneLikeViewport && isMatchdayTab;
}
