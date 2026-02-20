
# Fix: Default Flight Image on Timeline Card

## Problem
The `FlightGroupCard.tsx` component (the card shown on the timeline) checks for `flightOption.images?.[0]?.image_url`. When no image exists, it renders a plain dark glossy gradient background instead of the default flight photo.

The previous fix only added the `/default-flight.jpg` fallback to `PlaceOverview.tsx` (the detail/overview sheet), not to the timeline card itself.

## Solution
In `src/components/timeline/FlightGroupCard.tsx`, when `firstImage` is null/undefined, use `/default-flight.jpg` as the background image instead of the plain glossy gradient.

### Technical Details

**File:** `src/components/timeline/FlightGroupCard.tsx`

Replace the no-image fallback branch (lines 148-159) which currently renders a glossy gradient:

```tsx
// BEFORE (glossy dark background)
) : (
  <>
    <div className="absolute inset-0"
      style={{ background: 'linear-gradient(145deg, hsl(210, 22%, 14%), hsl(210, 10%, 7%))' }} />
    <div className="absolute inset-0"
      style={{ background: 'linear-gradient(152deg, ...)' }} />
  </>
)}
```

With the default flight image + diagonal fade (same treatment as when a real image exists):

```tsx
// AFTER (default flight photo)
) : (
  <>
    <img src="/default-flight.jpg" alt="Flight" className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 z-[5]"
      style={{ background: 'linear-gradient(155deg, transparent 22%, ...)' }} />
  </>
)}
```

This is a single-file, 4-line change. No other files affected.
