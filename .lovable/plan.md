

# Fix: Trip Settings Share Link Format

## Problem
`Dashboard.tsx` uses `(trip as any).invite_code` -- an unnecessary cast since `invite_code` is already on the `Trip` type. This is a leftover from when it was added before the type was updated.

`TripSettings.tsx` and `src/types/trip.ts` are already correct.

## Changes

### `src/pages/Dashboard.tsx` (lines 150-154)
Remove `(trip as any)` casts and use `trip.invite_code` directly:

```typescript
const url = trip.invite_code
  ? `${window.location.origin}/invite/${trip.invite_code}`
  : `${window.location.origin}/trip/${trip.id}`;
```

This is a 2-line change in one file.

