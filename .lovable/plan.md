

# UX Fixes -- Icon, Transport Title, Drag Shake, Zoom, Undo

Six independent fixes across 7 files.

---

## 1. Trip Emoji Before Name in Header

**File:** `src/components/timeline/TimelineHeader.tsx` (line 51)

Replace the plain `<h1>` with a flex row that prepends `trip?.emoji` as a span before the name.

---

## 2. Transport Card: Use Place Name Not Coordinates

**File:** `src/pages/Timeline.tsx` (lines 898-905)

- Replace `toAddr.split(',')[0].trim()` with `toOpt?.name || toOpt?.location_name || toAddr.split(',')[0].trim()`, truncated to 25 chars.
- Update `departure_location` and `arrival_location` to prefer `fromOpt?.name` / `toOpt?.name` over raw addresses.

**File:** `supabase/functions/auto-generate-transport/index.ts` (lines 142-147)

- Rewrite `getLocationName()` to prefer `opt.name` (for non-flights), then `opt.location_name`, then flight-specific fields.

---

## 3. Increase Mobile Drag Hold to 400ms + Delay Locked Shake

**File:** `src/hooks/useDragResize.ts` (line 46)

- Change `TOUCH_HOLD_MS` from `200` to `400`.

**File:** `src/components/timeline/ContinuousTimeline.tsx` (lines 489-497, 1607-1610, 1715-1726, 1763-1766)

- Add `lockedTimerRef`, `startLockedAttempt(entryId)` (delayed 400ms), and `cancelLockedAttempt()` functions.
- Replace `onTouchStart` handlers for locked resize handles to use `startLockedAttempt` with `onTouchMove`/`onTouchEnd` cancellation.
- Replace `onTouchDragStart` for locked cards to use `startLockedAttempt`, and add `onTouchDragMove`/`onTouchDragEnd` cancellation for locked path.
- Keep `onMouseDown` handlers as immediate (desktop has no scroll conflict).

---

## 4. Move Zoom Toggle Into Header Overflow Menu

**File:** `src/components/timeline/TimelineHeader.tsx`

- Add `zoomLevel`, `onCycleZoom`, `zoomEnabled` props to the interface.
- Add `ZoomIn` to lucide imports.
- Add a zoom menu item in the dropdown (before theme toggle): shows "Zoom: 1x" / "75%" / "1.5x" and calls `onCycleZoom`.

**File:** `src/pages/Timeline.tsx`

- Pass `zoomLevel`, `onCycleZoom={cycleZoom}`, `zoomEnabled` to `<TimelineHeader>` (line 2868-2873).
- Delete the floating zoom button block (lines 3635-3652).

---

## 5. Undo: Card Deletion with Full Restore

**File:** `src/components/timeline/PlaceOverview.tsx`

- Add `pushAction` to the `PlaceOverviewProps` interface.
- Destructure it in the component.
- In the non-hotel delete handler (line 1277-1287): snapshot entry + options before delete, push undo action that re-inserts them.
- In the hotel "Just This Block" handler (line 1242-1251): same snapshot + undo pattern.
- In the hotel "Delete All" handler (line 1222-1234): snapshot current entry + options, push undo (partial restore for current entry).

**File:** `src/components/timeline/EntrySheet.tsx`

- Add `pushAction` to `EntrySheetProps` interface.
- Destructure and pass through to `<PlaceOverview>`.

**File:** `src/pages/Timeline.tsx`

- Pass `pushAction={pushAction}` to `<EntrySheet>` (around line 3278).

---

## 6. Undo: Lock/Unlock Toggle

**File:** `src/components/timeline/PlaceOverview.tsx` (lines 305-315)

- Capture `wasLocked` before toggling. After successful DB update, call `pushAction` with undo/redo that reverts/re-applies the lock state.

**File:** `src/pages/Timeline.tsx` (lines 2552-2566)

- After successful DB update in `handleToggleLock`, call `pushAction` with undo/redo that also does optimistic local updates.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/components/timeline/TimelineHeader.tsx` | Trip emoji, zoom in dropdown menu |
| `src/pages/Timeline.tsx` | Transport name fix, pass zoom to header, remove float zoom, pass pushAction to EntrySheet, lock undo |
| `src/hooks/useDragResize.ts` | TOUCH_HOLD_MS 200 to 400 |
| `src/components/timeline/ContinuousTimeline.tsx` | Delayed locked shake for touch |
| `src/components/timeline/EntrySheet.tsx` | Accept + pass pushAction prop |
| `src/components/timeline/PlaceOverview.tsx` | Accept pushAction, delete undo, lock undo |
| `supabase/functions/auto-generate-transport/index.ts` | getLocationName prefers name over coords |

