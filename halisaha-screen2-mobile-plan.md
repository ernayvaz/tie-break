# HALISAHA Screen 2 Mobile Refinement Plan

## Goal
- Bring both mobile screen 2 pitch states closer to the desktop field proportions while keeping a vertical mobile presentation.
- Enlarge the rotated field until the excessive left/right empty space is removed.
- Rework the opened overlay so the ball moves next to `7V7`, the question cards stack vertically, `Question 2` options stay on a single row, and `Question 1` keeps a premium but slightly tighter winner layout.

## Files In Scope
- `src/app/(app)/halisaha/halisaha-match-showcase.tsx`
- `src/components/halisaha/halisaha-challenge-overlay.tsx`
- `src/components/halisaha/halisaha-question-card.tsx`
- `src/app/globals.css`

## Implementation Checklist
- [ ] Refactor the mobile pitch scene so the rotated field layer is independent from the overlay UI.
- [ ] Closed screen 2:
  - keep the field rotated 90 degrees
  - increase the field scale until the large left/right gaps are effectively removed
  - keep the desktop-style field proportions while fitting the mobile board cleanly
- [ ] Open screen 2:
  - use the same rotated/enlarged field treatment behind the overlay
  - keep overlay content upright and readable on top of the rotated field
- [ ] Move the opened-state ball control to the left side of `7V7` while preserving its toggle behavior.
- [ ] Replace the split question layout with one vertical question stack in the opened overlay.
- [ ] Ensure `Question 2` answer choices stay side by side on one row in the opened overlay.
- [ ] Refine the `Question 1` winner block:
  - let the bars visually reach closer to the center logos
  - slightly reduce the overall block height
  - keep the look premium and elegant
- [ ] Re-check mobile-only selectors so desktop and non-screen-2 layouts do not regress.

## Verification Checklist
- [ ] Closed screen 2 field is visibly larger and no longer leaves oversized side gaps.
- [ ] Open screen 2 field is also rotated and enlarged behind the overlay.
- [ ] The ball sits to the left of `7V7` in the opened state and still toggles the view.
- [ ] Opened-state question cards are stacked vertically.
- [ ] `Question 2` options are on one row.
- [ ] `Question 1` bars extend closer to the logo block and the winner card is slightly shorter.
- [ ] Run lint/test/build after the update.
