

# Improve Flight Group Card Visual Design

## Goal
Add clear visual partitions between the check-in, flight, and checkout sections, and make the flight section visually prominent/highlighted as the hero of the card.

## Changes (single file: `FlightGroupCard.tsx`)

### 1. Clear visual partitions
- Replace the current subtle `border-b border-border/30` between sections with a solid divider using the flight category color at low opacity (e.g., `border-[catColor]/30` via inline style).
- Add a thin 1px separator line between each section so they read as distinct zones within one card.

### 2. Highlight the flight section
- Give the main flight section a stronger, more saturated background tint (e.g., `catColor` at ~20% opacity instead of the current `18` hex suffix).
- Add slightly more vertical padding (`py-4` instead of `p-3`) to give it visual weight compared to the compact airport sections.
- Make the flight name larger/bolder relative to the check-in/checkout text.

### 3. Subdued airport sections
- Reduce the check-in and checkout sections' background to a very faint tint (`catColor` at ~6-8% opacity).
- Use smaller text (`text-[10px]`) and muted colors so they clearly read as secondary to the flight.
- Add a small vertical line or dot accent on the left edge of each airport section to visually connect them to the flight's left border.

### Visual result

```text
+------------------------------------------+
| . Check-in  LHR T5   03:45-05:45 GMT    |  <- faint bg, small text
|==========================================|  <- colored divider
| [Flight badge]                           |
| BA432                                    |  <- bold, larger, highlighted bg
| LHR 05:45 GMT  ->  AMS 08:15 CET        |
|               [lock]                     |
|==========================================|  <- colored divider
| . Checkout   AMS      08:15-08:45 CET   |  <- faint bg, small text
+------------------------------------------+
```

## Technical Details

### File: `src/components/timeline/FlightGroupCard.tsx`

**Check-in / Checkout sections:**
- Background: `background: catColor + '0A'` (very faint ~4% opacity)
- Border between sections: `borderBottom/borderTop: 2px solid catColor + '30'` (~19% opacity colored line)
- Text stays `text-[10px]` muted
- Add a small colored dot/pip on the left (`w-1.5 h-1.5 rounded-full` with `catColor` bg) as a visual anchor

**Flight section (middle):**
- Background: `background: catColor + '22'` (stronger ~13% tint) when no image; keep gradient overlay when image present
- Increase padding to `p-4`
- Flight name: bump to `text-lg font-bold`
- Route line: `text-sm` instead of `text-xs`

No other files need changes -- this is purely a visual/styling update to `FlightGroupCard.tsx`.
