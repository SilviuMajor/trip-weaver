
# Performance Fixes for App Freezing

## Overview
Five targeted performance fixes to eliminate the "page unresponsive" freezes caused by realtime sync cascades and unoptimized queries.

---

## Fix 1: Debounce Realtime Sync (500ms)

### `src/hooks/useRealtimeSync.ts`
Replace the direct `onSync` callback with a 500ms debounced version using `useRef` and `useCallback`. This collapses rapid-fire database events into a single sync call.

---

## Fix 2: Filter `option_images` by Option IDs (Two-Step Query)

### `src/pages/Timeline.tsx` (lines 229-249)
Restructure `fetchData` into two sequential steps:
- **Step 1**: Fetch `entries` and `weather_cache` in parallel
- **Step 2**: Extract entry IDs, fetch `entry_options` filtered by those IDs
- **Step 3**: Extract option IDs, fetch `option_images` (filtered by option IDs) and `votes` in parallel

This prevents loading every image from every trip in the database.

---

## Fix 3: SKIP
Photo inserts are already batched. No changes.

---

## Fix 4: Memoize `getDays()`

### `src/pages/Timeline.tsx`
- Replace the `getDays()` function (lines 472-487) with a `useMemo` block producing a `days` variable
- Remove `const days = getDays()` on line 2234 (already replaced by memoized variable)
- Update all internal callers:
  - `handleTrimDay` (line 491): use `days` directly
  - `dayTimezoneMap` useMemo (line 541): use `days` directly
  - `dayLocationMap` useMemo (line 610): use `days` directly
  - `handleDropExploreCard` (line 1594): use `days` directly
  - `dayLabels` useMemo (line 2047): use `days` directly

---

## Fix 5: Concurrent Fetch Guard

### `src/pages/Timeline.tsx`
Add a `fetchingRef = useRef(false)` guard at the top of `fetchData`. If a fetch is already in progress, skip. Reset in a `finally` block.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/hooks/useRealtimeSync.ts` | Add 500ms debounce with useRef timer |
| `src/pages/Timeline.tsx` | Two-step query for option_images; memoize getDays(); add fetchingRef guard |
