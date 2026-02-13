

# Three Small Magnet Icon Fixes

## Fix 1 -- Hide magnet when no next entry
Already working correctly. Line 999 returns `null` when `hasNextEntry` is false, so no magnet renders. No code change needed.

## Fix 2 -- Increase z-index
**File: `src/components/timeline/ContinuousTimeline.tsx`, line 1021**

Change `z-30` to `z-[45]` so the magnet renders above transport connectors.

## Fix 3 -- Rotate icon 135 degrees
**File: `src/components/timeline/ContinuousTimeline.tsx`, line 1032**

Change `rotate-180` to `rotate-[135deg]`.

## Summary
Two single-line edits in `ContinuousTimeline.tsx`. Nothing else changes.

