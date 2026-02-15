

# One-Time "Hold to move / Tap to view" Tooltip on First Card

## Overview
Show a small dark tooltip below the first non-transport, non-flight-linked entry card on the timeline. It appears once per device, auto-dismisses after 4 seconds, and is dismissed immediately on any card interaction. Stored in `localStorage` under `tr1p_card_hint_shown`.

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### 1. Add state (~after existing useState declarations)
Add a `showCardHint` state initialized from localStorage, defaulting to `true` if the flag is absent (with a try/catch for private browsing).

### 2. Add auto-dismiss effect
A `useEffect` that sets a 4-second timeout to hide the hint and persist the flag to localStorage. Cleans up on unmount.

### 3. Add a dismiss helper
A small inline helper (or just repeated 3-line snippet) that sets `showCardHint(false)` and writes to localStorage. This will be called:
- In the `onCardTap` wrapper (the `onClick` on the EntryCard at ~line 1404)
- In the `onTouchStart` handler on the card wrapper div (line 1164)
- In the `onDragStart` handler on the EntryCard (line 1413)

### 4. Render the tooltip
Inside the entry rendering loop, after the `EntryCard` block (inside the `<div className="relative h-full">` at line 1384), add the tooltip conditionally. The condition checks:
- `showCardHint` is true
- This is the first qualifying entry: not transport (`!isTransport`), not flight-linked (`!entry.linked_flight_id`), not a flight group (`!flightGroup`)
- Use a tracking variable (`hintRendered`) set to true after the first render, or simply check `index === firstHintIndex` where `firstHintIndex` is computed via `sortedEntries.findIndex(...)` before the loop

The tooltip markup:
```
<div className="absolute z-50 left-1/2 -translate-x-1/2 animate-fade-in pointer-events-none"
     style={{ top: height + 8 }}>
  <div className="relative bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
    Hold to move · Tap to view
    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
  </div>
</div>
```

Positioned just below the card (`top: height + 8`), dark background with light text, upward-pointing arrow, `pointer-events-none` so it never blocks touch.

### 5. Compute first hint index
Before the entry mapping loop, compute:
```ts
const firstHintIndex = showCardHint
  ? sortedEntries.findIndex(e => {
      const cat = e.options[0]?.category;
      return !isTransportEntry(e) && !e.linked_flight_id && cat !== 'airport_processing';
    })
  : -1;
```
Then in the loop, render the tooltip when `index === firstHintIndex`.

## What does NOT change
- EntryCard component itself
- Any drag/resize behavior
- Any other timeline rendering
- Card interaction logic (just adds a dismiss call alongside existing handlers)
