

# Timeline UI Polish: Gaps, Compact Cards, Lock Icons, Sidebar Rework

## Overview

Six targeted changes to improve the timeline's usability and visual clarity:

1. **Gap buttons always visible** with vertical dashed line between events
2. **"+ Add something" button** for gaps over 2 hours, positioned near event edges; transport button for gaps under 2 hours (mutually exclusive)
3. **Compact cards** for events under 2 hours -- tighter layout with all info
4. **Lock icon outside card** -- always visible, positioned top-right outside the card boundary
5. **Rename "Ideas" filter to "Not Used" and sidebar title to "Trip Events"**
6. **Independent sidebar scroll** with sticky headers for both sidebar and calendar

---

## 1. Gap Buttons: Always Visible + Vertical Dashed Line

### Current
- Buttons are `opacity-0 hover:opacity-100` (invisible until hover)
- No visual connector between events

### Changes

**File: `src/components/timeline/CalendarDay.tsx`** (lines ~382-430)

- Remove `opacity-0 hover:opacity-100` from gap buttons -- make them always visible with subtle styling
- Add a vertical dashed line spanning the full gap between each pair of consecutive events:
  - Positioned at `left: 50%`, from top card's bottom edge to bottom card's top edge
  - Style: `border-left: 2px dashed` with `border-primary/20` color
  - The button sits centered on this line at the midpoint

### Visual
```text
[Event A card]
      |
      |  (dashed vertical line)
      |
   [Transport]   <-- always visible button
      |
      |
[Event B card]
```

---

## 2. "Transport" vs "+ Add something" (Mutually Exclusive)

### Logic

- **Gap < 120 minutes (2 hours)**: Show "Transport" button only. Clicking it instantly begins creating a transport entry between the two events (triggers TransportPicker or transport creation flow).
- **Gap >= 120 minutes**: Show "+ Add something" button only. Clicking opens the standard entry creation form, but the form includes a "Transport" category option that, if selected, triggers transport creation between the two places.

### Positioning

- **Transport button**: Centered vertically in the gap (current position on the dashed line)
- **"+ Add something" button**: Positioned approximately 24px below the first event's bottom edge and 24px above the next event's top edge (two buttons, one near each event). If the gap is large enough for both, show both. If tight, show just one centered.

Actually, per user answer -- mutually exclusive, so:
- Gap < 2h: one "Transport" button centered
- Gap >= 2h: one "+ Add something" button centered

### Changes

**File: `src/components/timeline/CalendarDay.tsx`**

- Change threshold from `90` to `120` minutes for the transport vs add decision
- Rename "Event" label to "+ Add something"
- Wire transport button click to trigger transport creation flow directly (call `onAddTransport` callback instead of `onAddBetween`)
- Wire "+ Add something" click to `onAddBetween` (existing entry form, which already has category selection including transport)

**File: `src/pages/Timeline.tsx`**

- Add `onAddTransport` prop/handler to CalendarDay that receives both entry IDs and triggers transport creation between them

---

## 3. Compact Cards for Events Under 2 Hours

### Current thresholds
- `isCompact`: card height < 40px (single line)
- `isMedium`: card height 40-80px (two lines, no badge)
- Full card: > 80px

At 80px/hour, a 2-hour event = 160px. Events under 2 hours (< 160px) should use a tighter layout.

### Changes

**File: `src/components/timeline/EntryCard.tsx`**

- For the "medium" layout (40-80px): already tight, keep as is
- For "full" cards that are under ~160px tall (events < 2h): create a new "condensed" variant:
  - Reduce padding from `p-4` to `p-2.5`
  - Reduce title font from `text-lg` to `text-sm`
  - Reduce category badge to smaller size
  - Keep all info (emoji, name, time range, duration) but with `text-xs` throughout
  - Remove the top margin on category badge (`mb-3` to `mb-1`)
  - Tighten vertical spacing between elements

**File: `src/components/timeline/CalendarDay.tsx`**

- Pass a new `isCondensed` prop to EntryCard when the card height is between 80px and 160px (i.e., events between 1 and 2 hours)

---

## 4. Lock Icon Outside the Card

### Current
Lock icon is `absolute top-1.5 right-1.5` inside the card, rendering over the card content.

### Changes

**File: `src/components/timeline/EntryCard.tsx`**

- Remove the lock button from inside the card (all three layouts: compact, medium, full)
- The lock icon will be rendered by the PARENT component (CalendarDay) outside the card boundary

**File: `src/components/timeline/CalendarDay.tsx`**

- Wrap each EntryCard in a container `div` with `position: relative`
- Add the lock icon as a sibling element positioned `absolute -top-2 -right-2` (outside the card, overlapping the corner)
- Style: small circle background (`bg-background border border-border rounded-full p-0.5 shadow-sm`)
- Always visible (not hover-dependent)
- Locked: `Lock` icon with `text-amber-500` (prominent)
- Unlocked: `LockOpen` icon with `text-muted-foreground/50` (subtle but visible)

### Visual
```text
                    [lock icon]
+---------------------------+
| Event card content        |
|                           |
+---------------------------+
```

---

## 5. Rename "Ideas" to "Not Used" and "Entries Bank" to "Trip Events"

### Changes

**File: `src/components/timeline/CategorySidebar.tsx`**

- Line 147: Change `label: 'Ideas'` to `label: 'Not Used'`
- Line 160: Change `Entries Bank` text to `Trip Events`

---

## 6. Independent Sidebar Scroll with Sticky Headers

### Current
The whole page scrolls together. The sidebar and calendar are inside `flex flex-1 overflow-hidden`, with `main` having `overflow-y-auto`.

### Changes

**File: `src/pages/Timeline.tsx`**

The layout already has `main` with `overflow-y-auto`. The sidebar (CategorySidebar) needs its own independent scroll.

**File: `src/components/timeline/CategorySidebar.tsx`**

- The sidebar header (with "Trip Events" title) and filter tabs should be `sticky top-0` within the sidebar's scroll container
- The sidebar's panel content `div` already has `flex h-full flex-col` with `overflow-y-auto` on the category sections -- this is correct
- Ensure the header and filter tabs are outside the `overflow-y-auto` container, using `sticky` positioning so they stay pinned as the category list scrolls

**File: `src/components/timeline/CalendarDay.tsx`**

- Day headers already have `sticky` with `top: 0` and `z-20` -- this should work correctly within the `main` overflow container
- Verify that the `TimelineHeader` (global header) is `sticky top-0 z-30` (it is, line 132 of TimelineHeader) and the day headers sit below it
- Update day header sticky `top` to account for the TimelineHeader height (~52px): `style={{ top: '52px' }}` so day headers stick just below the global header instead of overlapping it

---

## File Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/timeline/CalendarDay.tsx` | Edit | Always-visible gap buttons, vertical dashed line, 2h threshold, transport click handler, condensed prop, lock icon outside card, sticky day header offset |
| `src/components/timeline/EntryCard.tsx` | Edit | Remove lock icon from inside card, add condensed layout variant |
| `src/components/timeline/CategorySidebar.tsx` | Edit | Rename "Ideas" to "Not Used", rename "Entries Bank" to "Trip Events", ensure sticky scroll headers |
| `src/pages/Timeline.tsx` | Edit | Add transport creation handler prop, verify scroll layout |

No new files. No database changes.

---

## Technical Details

### Vertical dashed line between entries

```text
// For each gap between consecutive entries:
const gapTopPx = (aEndHour - startHour) * PIXELS_PER_HOUR;
const gapBottomPx = (bStartHour - startHour) * PIXELS_PER_HOUR;

<div
  className="absolute left-1/2 border-l-2 border-dashed border-primary/20 pointer-events-none"
  style={{ top: gapTopPx, height: gapBottomPx - gapTopPx }}
/>
```

### Condensed card threshold

```text
// In CalendarDay.tsx, when computing card rendering:
const heightPx = (endHour - startHour) * PIXELS_PER_HOUR;
const isCompact = heightPx < 40;
const isMedium = heightPx >= 40 && heightPx < 80;
const isCondensed = heightPx >= 80 && heightPx < 160; // 1-2 hour events
// Full layout for heightPx >= 160
```

### Lock icon outside card (in CalendarDay)

```text
<div className="relative">
  <EntryCard ... />
  {canEdit && (
    <button
      onClick={() => onToggleLock(entry.id, entry.is_locked)}
      className="absolute -top-2 -right-2 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background shadow-sm"
    >
      {entry.is_locked
        ? <Lock className="h-3 w-3 text-amber-500" />
        : <LockOpen className="h-3 w-3 text-muted-foreground/50" />
      }
    </button>
  )}
</div>
```

### Day header sticky offset

The global TimelineHeader is ~52px tall and sticky at top:0. Day headers need `top: 52px` to stack below it:
```text
style={{ top: 52 }}
```

