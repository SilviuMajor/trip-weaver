

# Fix Hotel and Flight Blocks on Undated Trips -- Reference Date Remapping

## Overview
When a trip is created with "I don't know when" (undated), the timeline uses reference dates (2099-01-01, 2099-01-02, etc.) for its day columns. But hotel and flight entries are created with real calendar dates from user input (e.g. 2026-02-21). The rendering engine tries to match real dates against reference dates, fails, and falls back to day 0 -- causing all blocks to stack on the same visual day.

The fix adds a `remapDate` function that converts real dates to reference dates for undated trips, applied in both the wizard and the timeline hotel wizard. A defensive fallback in `findDayIndex` prevents silent stacking when dates don't match.

## Changes

### 1. `src/pages/TripWizard.tsx`

**a) Add `remapDate` helper inside `handleCreate`** (after members insertion, before flight creation at line 387):
- For undated trips: finds the earliest real date across all flights and hotels, then remaps each date to `2099-01-01 + offset`
- For dated trips: identity function (no change)
- Auto-expands `duration_days` if entries span more days than current duration

**b) Update flight creation** (line 388-392):
- Use `remapDate(rawDate)` instead of raw `flight.date`

**c) Update `createHotelEntries` call** (line 394-396):
- Pass `remapDate` as a fifth parameter

**d) Update `createHotelEntries` function** (line 162):
- Add `remapDate` parameter to signature
- Remap check-in date and all overnight dates through `remapDate` before passing to `localToUTC`
- Update `dayIndex` to handle undated trips (compute offset from `2099-01-01` instead of returning `null`)

### 2. `src/components/timeline/HotelWizard.tsx`

Same pattern applied to the timeline version (used when adding hotels to an existing trip):

**a) Add `remapDate` helper inside `handleFinish`** (after the `nights` check at line 385):
- For undated trips: remaps real dates relative to check-in date to reference dates
- Auto-expands `duration_days` if hotel spans more days than current trip

**b) Remap check-in block dates** (lines 454-459):
- Use `remapDate(ciDate)` for timezone resolution and UTC conversion

**c) Remap overnight loop dates** (lines 462-477):
- Use `remapDate(...)` for both `nightDate` and `nextDate`

**d) Update `dayIndex`** (lines 449-452):
- For undated trips: compute offset from `REFERENCE_DATE` instead of returning `null`

### 3. `src/components/timeline/ContinuousTimeline.tsx`

**Defensive `findDayIndex` fallback** (lines 205-211):
- When exact date string matching fails, fall back to finding the closest day by timestamp proximity instead of hardcoding `return 0`
- Prevents silent stacking on day 0 for any edge case where dates don't align

## Technical Details

The `remapDate` function for the wizard:
```text
remapDate(realDate) =
  offset = differenceInCalendarDays(realDate, earliestRealDate)
  return format(addDays("2099-01-01", max(0, offset)), "yyyy-MM-dd")
```

The `findDayIndex` fallback:
```text
If no exact date match found:
  Find the day whose timestamp is closest to the entry's timestamp
  Return that day's index (instead of 0)
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/TripWizard.tsx` | Add remapDate, update createHotelEntries signature + usage, remap flight dates, fix dayIndex for undated |
| `src/components/timeline/HotelWizard.tsx` | Add remapDate in handleFinish, remap all dates, fix dayIndex, auto-expand duration |
| `src/components/timeline/ContinuousTimeline.tsx` | Defensive findDayIndex fallback using closest-day instead of hardcoded 0 |

