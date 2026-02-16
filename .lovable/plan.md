

# Add "Venue Closed" Warning on Timeline Placement

## Overview
When a venue with opening hours is placed on a day marked "Closed", show a warning toast and a red banner in the detail view.

## Changes

### 1. New helper in `src/lib/entryHelpers.ts`

Add `checkOpeningHoursConflict` function after the existing `getEntryDayHours`:

```typescript
export const checkOpeningHoursConflict = (
  openingHours: string[] | null,
  startTime: string
): { isConflict: boolean; message: string | null } => {
  if (!openingHours || openingHours.length === 0) return { isConflict: false, message: null };
  const d = new Date(startTime);
  const jsDay = d.getDay();
  const googleIndex = jsDay === 0 ? 6 : jsDay - 1;
  const dayHours = openingHours[googleIndex];
  if (!dayHours) return { isConflict: false, message: null };
  if (dayHours.toLowerCase().includes('closed')) {
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    return { isConflict: true, message: `This place is closed on ${dayNames[googleIndex]}` };
  }
  return { isConflict: false, message: null };
};
```

### 2. Warning toast in `src/pages/Timeline.tsx`

Two insertion points:

**a) `handleDropOnTimeline`** (around line 1450, after `await fetchData()`): Check the dropped entry's opening hours against the new `startIso` and show a destructive toast if closed.

**b) `handleAddAtTime`** (around line 346, after the success toast): Same check using `place.openingHours` and `startTime`.

Both use:
```typescript
const opt = entry.options?.[0];
if (opt?.opening_hours) {
  const { isConflict, message } = checkOpeningHoursConflict(opt.opening_hours, startIso);
  if (isConflict) {
    toast({ title: 'Venue may be closed', description: message, variant: 'destructive' });
  }
}
```

For `handleAddAtTime`, since we have the `place` object (not a DB entry), we check `place.openingHours` directly.

### 3. Warning banner in `src/components/timeline/PlaceOverview.tsx`

In the `PlaceDetailsSection` component (line 26-80), add a closed-day warning banner above the opening hours collapsible. Compute it using `checkOpeningHoursConflict` with `entryStartTime`, and render a red alert-style div when there is a conflict. Only show for entries that have a real scheduled time (not the reference date `2099-01-01`).

```tsx
{closedWarning && (
  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium">
    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
    <span>{closedWarning}</span>
  </div>
)}
```

## Files Summary

| File | Change |
|------|--------|
| `src/lib/entryHelpers.ts` | Add `checkOpeningHoursConflict` helper |
| `src/pages/Timeline.tsx` | Import helper; add warning toast in `handleDropOnTimeline` and `handleAddAtTime` |
| `src/components/timeline/PlaceOverview.tsx` | Import helper + AlertTriangle; add closed-day warning banner in `PlaceDetailsSection` |

