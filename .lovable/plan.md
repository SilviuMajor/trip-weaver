

# Comprehensive Timeline Enhancement Plan

## Overview

This plan covers 5 interconnected features:

1. **Duration label** on all timeline entry cards (bottom-right, bold)
2. **Sidebar improvements** -- remove "No entries" text, give unscheduled entries default times, reduce opacity for scheduled entries, double card height
3. **"LIVE" page** -- sidebar on desktop, tab on mobile, with placeholder content
4. **Transport feature** -- "Add transport" / "Add event" button between entries, transport cards on the time grid, multi-mode API calculation with departure time forecasting
5. **Overlap detection** -- red tint on overlapping portions of cards, auto-trigger conflict resolver

---

## 1. Duration Label on Entry Cards

Add a bold duration label (e.g. "2h 30m", "45m") to the bottom-right corner of every timeline entry card.

### Implementation

**File: `src/components/timeline/EntryCard.tsx`**

- Add a helper function to compute duration from `startTime` and `endTime`:
  ```
  formatDuration(startIso, endIso) -> "2h 30m" | "45m" | "3h"
  ```
- Render the label in the bottom-right corner of all three card layouts (compact, medium, full):
  - **Full card**: absolute positioned, bottom-right, bold text, semi-transparent background pill
  - **Medium card**: inline at the end of the time row
  - **Compact card**: after the time range text

---

## 2. Sidebar Improvements

### 2a. Remove "No entries" label

**File: `src/components/timeline/CategorySidebar.tsx`**

- Remove the `<p className="text-[10px]...">No entries</p>` fallback (line 150-151). Show nothing when a category is empty.

### 2b. Default time for unscheduled entries

**File: `src/pages/Timeline.tsx`** (in the sidebar entry rendering logic and data model)

- When entries have `is_scheduled === false`, they currently have whatever start/end time they were created with. No change needed to DB -- they already have times. The sidebar cards will use these times to show durations.

### 2c. Reduce opacity for scheduled entries in sidebar

**File: `src/components/timeline/SidebarEntryCard.tsx`**

- If `entry.is_scheduled === true`, apply `opacity-50` to the entire card wrapper. This visually differentiates entries already on the timeline.

### 2d. Double card height

**File: `src/components/timeline/SidebarEntryCard.tsx`**

- Change the card height from `h-[72px]` (when image) to `h-[144px]`
- For non-image cards, increase padding and add more vertical space (min-height ~144px)
- Show the duration label on sidebar cards too

---

## 3. "LIVE" Page

A panel to the LEFT of the calendar timeline with a placeholder.

### Desktop: Sidebar panel

**File: `src/pages/Timeline.tsx`**

- Add a new state: `liveOpen` (boolean, default false)
- Add a toggle button in `TimelineHeader` labeled "LIVE"
- Render a left sidebar (similar structure to the right CategorySidebar) when `liveOpen` is true
- The sidebar contains a centered placeholder: "Coming soon" with a radio/broadcast icon

**New file: `src/components/timeline/LivePanel.tsx`**

- Props: `open`, `onOpenChange`
- Desktop: renders as a `div` with `w-[320px]` on the left side
- Mobile: renders as a `Sheet` sliding from the left
- Content: placeholder centered text + icon

### Mobile: Sheet from left

- Uses the existing Sheet component with `side="left"`
- Toggle via a button in the header or a FAB

### Layout change in Timeline.tsx

Current layout:
```
<div className="flex flex-1 overflow-hidden">
  <main>...</main>
  <CategorySidebar />  (right)
</div>
```

New layout:
```
<div className="flex flex-1 overflow-hidden">
  <LivePanel />         (left)
  <main>...</main>
  <CategorySidebar />   (right)
</div>
```

---

## 4. Transport Feature

This is the most complex feature. Here's the full breakdown:

### 4a. "Add transport" / "Add event" button between entries

**File: `src/components/timeline/CalendarDay.tsx`**

Between every two consecutive entries on the timeline, render a button:

- **If gap < 90 minutes**: Show "Add transport" button (bus icon)
- **If gap >= 90 minutes**: Show "Add event" button (plus icon) -- this opens the regular entry form

The button is centered horizontally between the two cards, positioned at the midpoint of the gap.

Only visible on hover of the gap area (similar to existing + buttons).

### 4b. Transport mode picker popup

**New file: `src/components/timeline/TransportPicker.tsx`**

When "Add transport" is clicked:
1. A small popover appears with 4 mode buttons: Walk, Transit, Cycle, Drive (using emojis from `TRAVEL_MODES`)
2. Selecting a mode triggers API calls for ALL 4 modes simultaneously
3. Shows a loading spinner, then displays all 4 results with durations
4. The selected mode is highlighted; user can switch modes to change the transport card
5. "Confirm" button creates the transport entry

### 4c. Transport entry on the time grid

Transport entries are a special type:
- Category: `'transport'` (new category, NOT shown in the "All Entries" sidebar)
- `is_scheduled: true`
- Duration is fixed to the API result (not user-adjustable)
- Card shows: mode icon, duration ("12m walk"), and from/to labels
- Card is NOT draggable or resizable (no resize handles, no drag cursor)
- Mode switch buttons overlaid on the card with reduced opacity -- clicking re-fetches and resizes

**New category in `src/lib/categories.ts`**:
```
{ id: 'transport', name: 'Transport', emoji: '🚌', color: 'hsl(200, 50%, 60%)', ... }
```

**Filter transport from sidebar**: In `CategorySidebar.tsx`, filter out `transport` entries (like `airport_processing`).

### 4d. API enhancement: departure time forecasting

**File: `supabase/functions/google-directions/index.ts`**

- Accept optional `departureTime` parameter (ISO string)
- Pass it to the Routes API as `departureTime` field
- For TRANSIT: uses actual schedule data (up to 100 days in the future)
- For DRIVE: uses traffic prediction for that time
- For WALK/BICYCLE: departure time doesn't affect result but we send it anyway

When creating transport, the departure time = the end time of the previous entry (when the user would leave).

Also accept `modes` array parameter to calculate multiple modes in one call:
```json
{
  "fromAddress": "...",
  "toAddress": "...",
  "modes": ["walk", "transit", "drive", "bicycle"],
  "departureTime": "2026-03-15T14:00:00Z"
}
```

Returns an array of results, one per mode.

### 4e. Snap and between-transport buttons

After a transport card is placed, between the transport card and the next entry:

- Show a small "magnet" icon button (centered, ~30px below the transport card) that snaps the next event's start time to transport's end time (if the next event is not locked)
- Show a small "+" icon button to add another event in the remaining gap

These replace the current "+" buttons for that gap.

### 4f. Drag-to-create between events suggests transport

**File: `src/components/timeline/CalendarDay.tsx`** and **`src/pages/Timeline.tsx`**

When a user drags to create in empty space that happens to be between two events:
- After the entry form opens or before, check if the dragged slot is entirely between two existing entries
- If yes, show a small toast/prompt: "Also add transport between [Entry A] and [Entry B]?"
- If user confirms, trigger the transport picker for that gap
- If transport duration < gap, snap the next event to it (if not locked)

---

## 5. Overlap Detection and Red Tint

### 5a. Visual overlap indicator

**File: `src/components/timeline/EntryCard.tsx`**

- Accept a new prop: `overlapMinutes?: number` and `overlapPosition?: 'top' | 'bottom'`
- When `overlapMinutes > 0`, render a red gradient overlay on the overlapping portion of the card
- The red tint covers only the percentage of the card that overlaps

**File: `src/components/timeline/CalendarDay.tsx`**

- After computing layout positions, detect pairwise overlaps between consecutive entries
- For each overlapping pair, calculate how many minutes overlap
- Pass `overlapMinutes` and `overlapPosition` to the affected `EntryCard` components

### 5b. Auto-trigger conflict resolver on transport overlap

When a transport card is placed and it causes an overlap:
1. Show the red tint immediately
2. Auto-open the `ConflictResolver` dialog with smart recommendations:
   - "Push [next event] by Xm" (shift later)
   - "Shorten [next event] by Xm"
   - "Skip [next event]" (move to ideas)
   - "Return to hotel earlier" (if hotel entry exists later)
3. Use the existing deterministic conflict engine (`conflictEngine.ts`) for these recommendations
4. Add a new recommendation type: "Skip entry" that moves it to unscheduled

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/timeline/EntryCard.tsx` | Edit | Duration label + overlap red tint |
| `src/components/timeline/SidebarEntryCard.tsx` | Edit | Opacity for scheduled, double height, duration label |
| `src/components/timeline/CategorySidebar.tsx` | Edit | Remove "No entries", filter transport category |
| `src/components/timeline/LivePanel.tsx` | New | LIVE placeholder panel (left sidebar / mobile sheet) |
| `src/components/timeline/TransportPicker.tsx` | New | Mode selection + multi-mode API results popup |
| `src/components/timeline/CalendarDay.tsx` | Edit | Between-entry buttons, transport cards, overlap detection, snap button |
| `src/pages/Timeline.tsx` | Edit | LIVE panel state, transport creation logic, drag-suggest-transport |
| `src/lib/categories.ts` | Edit | Add 'transport' category |
| `src/lib/conflictEngine.ts` | Edit | Add "skip entry" recommendation type |
| `supabase/functions/google-directions/index.ts` | Edit | Multi-mode + departureTime support |

---

## Technical Details

### Duration formatting helper

```typescript
function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```

### Multi-mode directions API change

The edge function will accept a `modes` array and loop through each, returning:
```json
{
  "results": [
    { "mode": "walk", "duration_min": 45, "distance_km": 3.2 },
    { "mode": "transit", "duration_min": 18, "distance_km": 5.1 },
    { "mode": "drive", "duration_min": 12, "distance_km": 4.8 },
    { "mode": "bicycle", "duration_min": 22, "distance_km": 4.5 }
  ]
}
```

### Transport entry creation flow

1. User clicks "Add transport" between Entry A and Entry B
2. TransportPicker popover opens with 4 mode buttons
3. API is called with all 4 modes + `departureTime` = Entry A's end time
4. Results displayed; user picks preferred mode
5. On confirm:
   - Create entry with `category: 'transport'`, `start_time` = Entry A end, `end_time` = start + duration
   - Create entry_option with mode, from/to locations (inherited from A and B)
6. If transport end > Entry B start (overlap):
   - Show red tint on both cards
   - Auto-open conflict resolver with recommendations
7. If transport end < Entry B start (fits):
   - Show snap button between transport and Entry B

### Overlap calculation in CalendarDay

```typescript
// For each pair of consecutive entries
for (let i = 0; i < sorted.length - 1; i++) {
  const aEnd = getHourInTimezone(sorted[i].end_time, tz);
  const bStart = getHourInTimezone(sorted[i+1].start_time, tz);
  if (aEnd > bStart) {
    const overlapMin = Math.round((aEnd - bStart) * 60);
    // Pass to both cards
  }
}
```

### Google Routes API: departureTime note

- **TRANSIT**: Supports `departureTime` up to 100 days in the future. Returns schedule-accurate results.
- **DRIVE**: Supports `departureTime` for traffic-based predictions.
- **WALK / BICYCLE**: `departureTime` is accepted but does not affect the result (distance-based only).

This means transit and driving forecasts will be time-aware, which is great for trip planning. Walking and cycling will return consistent results regardless of time.

