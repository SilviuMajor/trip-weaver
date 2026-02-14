
# Six Fixes: Links, Text Selection, Magnet Visibility, Flight Magnets, Flight Snap Handler, TZ Gap

## Fix 1 -- Remove tappable links from timeline cards

### File: `src/components/timeline/EntryCard.tsx`

Two `<a>` tags with Google Maps links need to become plain `<p>` tags:

**Location 1 (condensed layout, lines 597-610)**: Replace the `<a href=...>` with a `<p>`:
```jsx
<p className={cn('flex items-center gap-0.5 text-[9px] truncate', firstImage ? 'text-white/70' : 'text-muted-foreground')}>
  <MapPin className="h-2.5 w-2.5 shrink-0" />
  <span className="truncate">{option.location_name}</span>
</p>
```

**Location 2 (full layout, lines 748-761)**: Replace the `<a href=...>` with a `<p>`:
```jsx
<p className={cn('mb-2 flex items-center gap-1 text-xs truncate', firstImage ? 'text-white/80' : 'text-muted-foreground')}>
  <MapPin className="h-3 w-3 shrink-0" />
  <span className="truncate">{option.location_name}</span>
</p>
```

## Fix 2 -- Make all text inside timeline cards non-interactive

### File: `src/components/timeline/EntryCard.tsx`

Add `pointer-events-none` to the content wrapper divs inside each card layout. These are the divs that contain titles, locations, ratings, times -- they never need their own pointer events since the outer `motion.div` handles all interactions.

**Condensed layout (line 567)**: The `<div className="relative z-10 flex h-full flex-col justify-between px-2.5 py-1.5">` becomes `<div className="relative z-10 flex h-full flex-col justify-between px-2.5 py-1.5 pointer-events-none">`

**Full layout (line 694)**: The `<div className="relative z-10 p-4">` becomes `<div className="relative z-10 p-4 pointer-events-none">` -- BUT the VoteButton and refresh popover inside need to remain interactive. Since VoteButton only appears in the full layout bottom row, wrap just the VoteButton area with `pointer-events-auto`.

Actually, looking at the code: the full layout has a VoteButton (line 862) which needs to remain clickable. The refresh popover only appears on transport cards (which have their own layout). So for the full layout, add `pointer-events-none` to the content div and add `pointer-events-auto` to the VoteButton wrapper.

**Compact layout (line 513)**: Add `pointer-events-none` to the inner content div.

**Medium transport (line 329)**: Add `pointer-events-none` to the content div.

**Compact transport (line 304)**: Add `pointer-events-none` to the content div.

**Condensed transport (lines 355-371)**: Add `pointer-events-none` to the content div, but keep the refresh popover trigger div (line 368) with `pointer-events-auto`.

**Full transport (lines 393-431)**: Content div stays, but this has the refresh popover internally; ensure the refresh area keeps `pointer-events-auto`.

For the "medium" (isMedium) regular event layout (line 440, lines 463): Add `pointer-events-none` to the inner content div.

## Fix 3 -- Magnet HIDDEN when next event is locked

### File: `src/components/timeline/ContinuousTimeline.tsx`

**Transport connector magnet (line 1213)**: Change condition from `{magnetState.showMagnet && (` to `{magnetState.showMagnet && !magnetState.nextLocked && (`. Remove the `nextLocked` conditional styling from className and icon color -- just use the unlocked green styling.

**Regular card magnet (line 1311)**: Same change -- add `&& !magnetState.nextLocked` to the condition. Remove the nextLocked ternary from className and icon.

## Fix 4 -- Magnet shows on flight groups

### File: `src/components/timeline/ContinuousTimeline.tsx`

**Update magnet state computation (lines 974-1011)**: Replace the early return for flights. The new logic:
- `airport_processing` or entries with `linked_flight_id` still return `showMagnet: false` (they're sub-entries)
- For `flight` category: compute `effectiveEndTime` using `flightGroup?.checkout?.end_time ?? entry.end_time`
- When scanning for next events, skip entries that are part of THIS flight group (`c.linked_flight_id === entry.id`, etc.)
- Use `effectiveEndTime` instead of `entry.end_time` for gap calculations

**Render magnet on flight group card (after line 1169, before the closing `</div>`)**: Add a magnet button identical to the regular card magnet, using the same onClick handler pattern.

## Fix 5 -- Magnet snap handler supports flights

### File: `src/pages/Timeline.tsx`

**In `handleMagnetSnap` (lines 493-693)**: After getting `entry` and `opt`, add flight handling:

```typescript
// For flights: use the group's effective end
let effectiveEndTime = entry.end_time;
if (opt.category === 'flight') {
  const checkout = entries.find(e => e.linked_flight_id === entry.id && e.linked_type === 'checkout');
  if (checkout) {
    effectiveEndTime = checkout.end_time;
  }
}
```

Then replace all references to `entry.end_time` in time calculations with `effectiveEndTime`:
- Line 574: `new Date(entry.end_time)` becomes `new Date(effectiveEndTime)`
- Line 600: `fromAddr` logic -- for flights, use `opt.arrival_location` first
- Line 606: `new Date(entry.end_time)` becomes `new Date(effectiveEndTime)`
- Line 629: `departureTime: entry.end_time` becomes `departureTime: effectiveEndTime`
- Line 640: `new Date(entry.end_time)` becomes `new Date(effectiveEndTime)`

Also update `fromAddr` to prioritize `arrival_location` for flights:
```typescript
const fromAddr = opt.category === 'flight'
  ? (opt.arrival_location || opt.address || opt.location_name)
  : (opt.address || opt.location_name || opt.arrival_location);
```

## Fix 6 -- TZ gap after flight-to-transport snap

This is addressed by Fix 5. The key insight: all times in DB are UTC ISO strings, and ms arithmetic on UTC is timezone-agnostic. By using `effectiveEndTime` (the checkout's UTC end_time), the transport starts exactly when checkout ends in UTC terms, which displays correctly in any timezone.

No additional code changes needed beyond Fix 5. The existing snap logic already uses pure UTC ms arithmetic (`new Date(...).getTime()`), which is correct.

## Files changed

1. `src/components/timeline/EntryCard.tsx` -- remove `<a>` links, add `pointer-events-none` to content wrappers
2. `src/components/timeline/ContinuousTimeline.tsx` -- hide magnet when locked, flight group magnet state + rendering
3. `src/pages/Timeline.tsx` -- `effectiveEndTime` for flights in magnet snap handler

## What does NOT change

- EntrySheet/overview (Google Maps links remain there)
- Planner sidebar cards
- Drag mechanics
- Chain drag
- Zoom system
