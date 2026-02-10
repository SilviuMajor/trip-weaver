

# Fix: Reposition "+" Buttons to Card Corners

## Problem

The "+" buttons are currently placed in the gutter (left of cards, between time labels and the gradient line) using negative `left` offsets. The user wants them at the **top-left and bottom-left corners of each card**, so users can insert something before or after any event.

## Current Implementation

- A standalone "+" button before the first entry (lines 360-379) -- positioned in gutter with `left: -14/-20`
- A standalone "+" button between/after entries (lines 614-684) -- also in gutter with gap-detection logic

Both are siblings of the card div, positioned absolutely within the grid container.

## New Approach

Move the "+" buttons **inside each card's container** so they are positioned relative to the card itself:

- **Top-left corner**: Small "+" button at `top: -10px, left: -10px` (overlapping the card corner). Clicking inserts an entry before this one.
- **Bottom-left corner**: Small "+" button at `bottom: -10px, left: -10px`. Clicking inserts an entry after this one.

This eliminates the need for gap-detection logic and the separate "before first entry" button. Every card simply has two insertion points.

The buttons will show on hover (using `group-hover` or `opacity-0 hover:opacity-100`) to keep the UI clean.

## File: `src/components/timeline/CalendarDay.tsx`

### Changes

1. **Remove** the standalone "before first entry" + button block (lines 360-379)

2. **Remove** the entire between/after + button block (lines 614-684)

3. **Add two + buttons inside each card's inner container** (the `<div className="relative h-full">` at line 510). These will be:
   - Top-left: absolutely positioned at `top: -10, left: -10`, triggers `onAddBetween` with a time 60 minutes before the entry start
   - Bottom-left: absolutely positioned at `bottom: -10, left: -10`, triggers `onAddBetween` with the entry's end time
   - Both use `z-20`, `opacity-0 group-hover:opacity-100` transition for clean appearance
   - The parent card container (line 498) gets a `group` class for hover detection

4. Add `group` class to the card wrapper div so the + buttons appear on hover

### Visual Result

```text
  +------------------+
  |+ (top-left)       |
  |                   |
  |   Card Content    |
  |                   |
  |+ (bottom-left)    |
  +------------------+
```

Both buttons are small (20x20px) dashed-border circles, matching the existing style but positioned on the card corners instead of the gutter.

## No other files need changes

This is a purely positional change within `CalendarDay.tsx`. The `FlightGroupCard` and `EntryCard` components don't need modification -- the + buttons are rendered by the parent layout.
