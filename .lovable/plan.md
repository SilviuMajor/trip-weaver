
# Refresh Button, Gap Fix, and Lock Icon Repositioning

## Overview

Three fixes: (1) Add a refresh button to the header that recalculates all transport and weather, (2) Remove the gap between tab bar and timeline content, (3) Move lock icons from the left side to the right side of cards.

## 1. Refresh Button in Header

**File: `src/components/timeline/TimelineHeader.tsx`**

Add a `RefreshCw` icon button to the right side of the header, positioned before the Settings cog. The header right side becomes: Refresh | Settings | Exit.

New props:
- `onRefresh: () => Promise<void>` -- callback to trigger refresh
- `refreshing: boolean` -- controls spin animation

The button shows `RefreshCw` icon with `animate-spin` class when `refreshing` is true.

**File: `src/pages/Timeline.tsx`**

Add a `handleGlobalRefresh` function that:
1. Sets a `globalRefreshing` state to true
2. Calls `supabase.functions.invoke('auto-generate-transport', { body: { tripId } })` to recalculate all transport routes (this re-fetches directions for existing connectors)
3. Calls `supabase.functions.invoke('fetch-weather', ...)` to refresh weather data for all trip days/locations
4. Calls `fetchData()` to reload everything
5. Shows toast: "Weather and routes updated"
6. Sets `globalRefreshing` to false

Pass `onRefresh={handleGlobalRefresh}` and `refreshing={globalRefreshing}` to `TimelineHeader`.

For weather refresh, the function needs `tripId` and the trip's day-location segments (latitude/longitude per date range). The existing `dayLocationMap` and trip dates provide this data.

## 2. Fix Gap Between Tab Bar and Timeline Content

**File: `src/pages/Timeline.tsx`**

Investigate and remove any extra padding/margin between the `TripNavBar` component and the `<main>` content area. The likely cause is:
- The `<main>` element may have top padding
- The `CalendarDay` component's day header has padding that creates visual space
- There may be wrapper divs with unnecessary spacing

The fix: ensure the `<main>` tag has no top padding (`pt-0`), and the first `CalendarDay`'s sticky header sits flush against the tab bar. Reduce any `py-3` or `pt-3` on the first day's content area.

**File: `src/components/timeline/CalendarDay.tsx`**

The day header div currently has `py-3` padding. This should be kept but the sticky positioning should place it right below the tab bar. Check the `top` value on the sticky day header -- it should be `top-[calc(57px+41px)]` (header height + tab bar height) so it stacks correctly without a gap.

Currently the day header has `sticky top-0` which means it sits at the top of its scroll container (the `<main>` element), not below the fixed header/tab bar. Since header and tab bar are `sticky` (not `fixed`), and are outside the `<main>` scroll container, there should be no gap issue from sticky positioning.

The actual gap is likely from padding on the content wrappers. Remove any `pt-*` or `mt-*` on the main content area between the tab bar and the first calendar day.

## 3. Reposition Lock Icon to Right Side

**File: `src/components/timeline/CalendarDay.tsx`**

Move the lock icon button from `-left-2` to `-right-3` (outside the right edge of the card, in the gutter/margin area). Increase size from `h-5 w-5` to `h-7 w-7` for easier tapping (~28px).

For regular entries (non-flight, non-transport):
- Change: `absolute top-1/2 -translate-y-1/2 -left-2` to `absolute top-1/2 -translate-y-1/2 -right-3`
- Locked state: solid filled orange lock icon (`Lock` with `text-primary` or `text-amber-500`, add `fill-amber-500` for filled appearance)
- Unlocked state: outline-only lock icon (`LockOpen` with `text-muted-foreground/40`)
- Size: `h-4 w-4` icons inside `h-7 w-7` button

For flight cards:
- Remove the lock icon entirely (flights are always locked, no toggle needed as per requirements)

For transport connectors:
- No lock icon (already the case -- transport cards don't show lock icons)

**Styling updates for locked state on cards:**
- Remove the `border-dashed border-2 border-muted-foreground/40` styling from locked cards in `EntryCard.tsx` (the lock icon in the gutter is sufficient visual indicator)
- Keep the normal border styling for locked and unlocked cards alike

## Files Changed

| File | Change |
|---|---|
| `src/components/timeline/TimelineHeader.tsx` | Add refresh button with spin animation before settings cog |
| `src/pages/Timeline.tsx` | Add `handleGlobalRefresh` function, `globalRefreshing` state, pass to header, fix gap padding |
| `src/components/timeline/CalendarDay.tsx` | Move lock icon from left to right gutter, increase size, remove flight lock icon, update styling |
| `src/components/timeline/EntryCard.tsx` | Remove locked-state dashed border styling (lock is now external) |

## Technical Notes

- Refresh button icon: `RefreshCw` from lucide-react, with `animate-spin` when active
- Lock icon positioning: `absolute top-1/2 -translate-y-1/2 -right-3 z-30` with `h-7 w-7` container
- Locked appearance: `Lock` icon with `fill-current text-primary` (solid orange filled)
- Unlocked appearance: `LockOpen` icon with `text-muted-foreground/40` (outline only, muted)
- The `marginRight: 8` on the grid container in CalendarDay may need to increase to `16` or `24` to make room for the right-side lock icon
- Transport refresh in `handleGlobalRefresh` calls the `auto-generate-transport` edge function which handles recalculating all routes
- Weather refresh calls `fetch-weather` with the trip's location segments derived from `dayLocationMap`
