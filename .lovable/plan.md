

# Timeline Card Design, Layout & Scroll Fixes

Seven changes across 4 files.

---

## 1. Remove Card Corner + Buttons

**File:** `src/components/timeline/ContinuousTimeline.tsx` (lines 1793-1828)

Delete the entire block containing both `{onAddBetween && (() => {` IIFE calls that render the dashed `<Plus>` circles at top-left and bottom-left of each card. Keep the `Plus` import since it's still used by gap "Add something" buttons.

---

## 2. Fix Scroll-on-Card (Critical Mobile Bug)

**File:** `src/components/timeline/EntryCard.tsx` (lines 410, 434, 459, 496, 562)

Replace all 5 occurrences of `touchAction: 'none'` with `touchAction: 'pan-y'` (keeping other style properties like `borderLeftColor` where present).

**File:** `src/hooks/useDragResize.ts` (lines 335-418)

Replace the entire `onTouchStart` callback with a two-phase approach:
- **Phase 1 (hold window):** Attach a `passive: true` `checkMovement` listener that allows native browser scrolling. If finger moves > threshold, cancel the hold timer.
- **Phase 2 (after 400ms hold):** Remove passive listener, attach `passive: false` `handleDragMove` listener that calls `preventDefault()` and handles drag positioning.

This ensures native scroll momentum works when touching cards, and only hijacks touch events after confirming a deliberate long-press.

---

## 3. Align Moving-Time Pills to Gutter

**File:** `src/components/timeline/ContinuousTimeline.tsx` (lines 1940, 1943, 1957)

Change all 3 occurrences of `left: -72` to `left: -48` to align drag time pills with hour labels.

---

## 4. Daylight Tint -- Deep Night + Golden-Hour Bands + UTC Fix

**File:** `src/components/timeline/ContinuousTimeline.tsx` (lines 1836-1872)

Replace the sunrise/sunset gradient block:
- Fix UTC bug: Use `getHourInTimezone(sunTimes.sunrise.toISOString(), dayTz)` instead of `getUTCHours()` to get correct local hours.
- Resolve `dayTz` via `getDayTzInfo(day)?.activeTz || homeTimezone`.
- Keep the existing edge bar gradient.
- Add a full-width daylight tint layer (`z-[1]`, `pointer-events-none`) with deep navy overlay for night hours and warm amber bands at sunrise/sunset transitions, fully transparent during daytime.
- Wrap both elements in a `Fragment` with a key.

Import `Fragment` from React (update the existing import on line 1).

---

## 5. Bolder Hour Labels

**File:** `src/components/timeline/ContinuousTimeline.tsx` (line 1148)

Change `font-medium text-muted-foreground/50` to `font-semibold text-muted-foreground/70` for increased visibility.

---

## 6. Bigger Weather Emojis + Fix Centering

**File:** `src/components/timeline/WeatherBadge.tsx` (lines 31-33)

- Change `gap-0.5` to `gap-1`
- Change emoji span from `text-sm` to `text-base`

**File:** `src/components/timeline/ContinuousTimeline.tsx` (line 1903)

Change weather centering offset from `-6` to `-10` to properly center the now-larger badge at the half-hour mark.

---

## 7. Slightly Bigger TZ Change Pill

**File:** `src/components/timeline/ContinuousTimeline.tsx` (line 1886)

Change `px-2 py-0.5 text-[10px]` to `px-2.5 py-1 text-xs` for improved readability.

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/components/timeline/ContinuousTimeline.tsx` | Remove card +buttons, align drag pills, daylight tint with UTC fix, bolder hour labels, weather centering, bigger TZ pill |
| `src/hooks/useDragResize.ts` | Two-phase touch lifecycle: passive during hold, non-passive after drag starts |
| `src/components/timeline/EntryCard.tsx` | `touchAction: 'none'` to `touchAction: 'pan-y'` on all 5 tiers |
| `src/components/timeline/WeatherBadge.tsx` | Emoji `text-sm` to `text-base`, `gap-0.5` to `gap-1` |

