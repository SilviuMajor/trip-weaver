
# Fix: Timeline Freezes Due to 26,600-Day Loop

## Root Cause

The trip's `end_date` was corrupted to `2099-01-01` (the reference date used for unscheduled entries). The `autoExtendTripIfNeeded` function doesn't filter out unscheduled entries, so when one is created with a timestamp at `2099-01-01`, it extends `end_date` to that date.

The `days` useMemo then loops from `2026-02-21` to `2099-01-01`, creating ~26,600 Date objects and attempting to render them all -- freezing the browser instantly.

## Fix 1: Guard `autoExtendTripIfNeeded` against reference dates

In `autoExtendTripIfNeeded` (line 44-51), skip entries whose date matches or exceeds the reference date:

```typescript
const entryDateStr = format(new Date(entryEndIso), 'yyyy-MM-dd');
if (entryDateStr >= REFERENCE_DATE_STR) return; // Don't extend for unscheduled entries
```

This prevents the corruption from happening again.

## Fix 2: Cap the `days` array as a safety net

In the `days` useMemo (line 489-504), add a safety cap so even if bad data exists, the app won't freeze:

```typescript
const end = parseISO(trip.end_date!);
const maxEnd = addDays(start, 60); // Safety cap: max 60 days
const cappedEnd = end < maxEnd ? end : maxEnd;
```

Use `cappedEnd` instead of `end` in the while loop.

## Fix 3: Repair the corrupted data

Run a database update to fix the current trip's `end_date`. The last scheduled entry is on `2026-02-23`, so `end_date` should be `2026-02-23`:

```sql
UPDATE trips
SET end_date = '2026-02-23'
WHERE id = '561a31b0-7657-47b4-adba-30b87df48741'
  AND end_date = '2099-01-01';
```

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Add reference date guard in `autoExtendTripIfNeeded`; add safety cap in `days` useMemo |
| Database | Fix corrupted `end_date` for the affected trip |
