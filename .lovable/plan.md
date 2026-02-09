

# Unscheduled Options Panel and Smart Scheduling

## Overview

This is a fundamental rethinking of how "options" work. Instead of multiple options swiped within a single time slot, activities can exist as **unscheduled ideas** in a side panel, then be dragged onto the timeline. When placed, the system live-calculates travel times and walks the user through resolving any time conflicts step-by-step.

---

## Core Concepts

### Current Model (being replaced)
- An `entry` has a fixed time slot. Multiple `entry_options` live inside it (swiped horizontally, voted on).

### New Model
- An `entry` can be **scheduled** (has real start/end times) or **unscheduled** (parked in the side panel).
- Multiple options for the same type of activity (e.g. "lunch spots") are grouped together. When one is placed on the timeline, the others stay in the panel as alternatives.
- Placing an option triggers live travel calculation and a step-by-step conflict resolution dialog.

---

## Database Changes

### `entries` table
- Add `is_scheduled` (boolean, default true) -- false means it lives in the side panel
- Add `scheduled_day` (integer, nullable) -- for day-assigned but unscheduled entries (e.g. "Day 2 lunch ideas"). Null means completely unassigned.
- Add `option_group_id` (uuid, nullable) -- groups related alternatives together (e.g. all lunch spot options share the same group ID)

### New table: `option_groups`
- `id` (uuid, PK, default gen_random_uuid())
- `trip_id` (uuid, not null)
- `label` (text, not null) -- e.g. "Lunch spots", "Evening activity"
- `created_at` (timestamptz, default now())
- RLS: same open policies as entries

---

## Feature 1: Side Panel for Unscheduled Options

### UI: Toggle Panel
- A button in the `TimelineHeader` (e.g. a tray/inbox icon) toggles the panel open/closed
- Panel slides in from the right side, pushes or overlays the timeline
- Panel width: approximately 320px on desktop, full-screen drawer on mobile

### Panel Contents
- **Unassigned section**: Options not tied to any day
- **Per-day sections**: Collapsible sections for day-assigned options (e.g. "Day 2 ideas")
- Each option shown as a compact card (category emoji, name, location)
- Drag handle on each card for drag-and-drop

### Adding Unscheduled Entries
- In the `EntryForm`, the "When?" step gets a new choice: **"Add to ideas panel"** (instead of picking a specific time)
- Optional: assign to a specific day or leave completely unassigned
- Optional: assign to an option group (create new or add to existing)

### Files
- New: `src/components/timeline/IdeasPanel.tsx` -- the side panel component
- New: `src/components/timeline/IdeaCard.tsx` -- compact card for panel items
- Edit: `src/components/timeline/TimelineHeader.tsx` -- add toggle button
- Edit: `src/pages/Timeline.tsx` -- panel state, layout adjustment
- Edit: `src/components/timeline/EntryForm.tsx` -- "Add to ideas" option in the "When?" step

---

## Feature 2: Drag from Panel to Timeline

### Drag-and-Drop Mechanism
- Uses HTML5 drag and drop (or pointer events for mobile)
- Dragging from the panel onto a specific day/time slot on the timeline
- Visual feedback: ghost card follows cursor, timeline highlights valid drop zones
- Drop snaps to 15-minute intervals (consistent with existing behavior)

### On Drop
1. Update the entry: set `is_scheduled = true`, set `start_time` and `end_time` based on drop position
2. If the entry belongs to an `option_group_id`, the other entries in that group stay in the panel
3. Trigger live travel calculation (Feature 4)
4. Show conflict resolution dialog if needed (Feature 5)

### Files
- Edit: `src/components/timeline/CalendarDay.tsx` -- add drop zone handlers
- Edit: `src/components/timeline/IdeasPanel.tsx` -- drag source handlers
- Edit: `src/pages/Timeline.tsx` -- coordinate drag state between panel and timeline

---

## Feature 3: Option Groups (Multiple Choices for Same Slot)

### Behavior
- When you place one option from a group, it becomes the "active" choice on the timeline
- The other options in the group remain in the panel, shown slightly dimmed with a label like "Alternative to: [active option name]"
- You can swap: drag an alternative onto the active one to replace it (the replaced one goes back to the panel)
- Locking an entry (existing feature) "confirms" the choice -- alternatives can optionally be dismissed

### Visual on Timeline
- When an entry has alternatives in the panel, show a small badge/indicator (e.g. "2 alternatives") on the card

### Files
- Edit: `src/components/timeline/EntryCard.tsx` -- alternatives badge
- Edit: `src/components/timeline/IdeasPanel.tsx` -- show grouped alternatives
- Edit: `src/components/timeline/EntryOverlay.tsx` -- show alternatives list, swap button

---

## Feature 4: Live Travel Time Calculation

### Trigger
- Whenever an entry is placed on the timeline (from panel or moved), calculate travel times to/from adjacent entries
- Uses the existing `google-directions` edge function

### Display
- On each entry card, show a small "+X min" or "-X min" badge indicating the travel time impact
- Green badge = fits within available gap, Red badge = exceeds available gap
- Travel time shown between entries (reuses existing `TravelSegmentCard`)

### Implementation
- After placing an entry, find the previous and next scheduled entries for that day
- Call `google-directions` for both segments (previous-to-new, new-to-next)
- Compare total travel time against available gaps
- Calculate the discrepancy (+ or - minutes)

### Files
- Edit: `src/components/timeline/CalendarDay.tsx` -- trigger calculation on entry placement
- Edit: `src/components/timeline/EntryCard.tsx` -- show +/- minutes badge
- New: `src/hooks/useTravelCalculation.ts` -- encapsulate travel calculation logic

---

## Feature 5: Step-by-Step Conflict Resolution

### Trigger
- When placing an entry creates a time conflict (travel time causes overlap or exceeds available gap)

### Dialog Flow (Step-by-Step)
1. **Show the problem**: "Placing [Activity] here requires 25 extra minutes of travel time"
2. **Show smart recommendations**: The system analyzes the day's schedule and suggests fixes:
   - "Arrive at [Hotel] 25 minutes later" (shift a flexible entry)
   - "Shorten [Lunch] by 25 minutes"
   - "Start [Activity] 25 minutes earlier"
   - Each recommendation shows what it affects
3. **User picks one** (or picks "I'll figure it out myself")
4. **If user picks a recommendation**: Apply the time change, recalculate all travel for the day, lock the entry in
5. **If user picks "I'll figure it out myself"**: Place the entry but show a visible conflict marker on the timeline (e.g. red warning icon, overlapping border)

### Conflict Markers (for "figure it out myself")
- Red/orange warning icon on the entry card
- Tooltip or badge showing "-25 min conflict"
- The entry is placed but NOT locked, so it can be easily adjusted

### Smart Recommendation Engine
- Looks at all entries on that day
- Identifies which ones are NOT locked
- For each unlocked entry, calculates how much it could be shifted or shortened
- Ranks recommendations by least disruption (prefer shifting end times over start times, prefer entries adjacent to the conflict)

### Files
- New: `src/components/timeline/ConflictResolver.tsx` -- the step-by-step dialog component
- New: `src/lib/conflictEngine.ts` -- logic for analyzing conflicts and generating recommendations
- Edit: `src/components/timeline/EntryCard.tsx` -- conflict marker display
- Edit: `src/pages/Timeline.tsx` -- manage conflict resolution state

---

## Feature 6: Returning Entries to Panel

### Behavior
- From the `EntryOverlay` (detail view), add a "Move to ideas" button
- This sets `is_scheduled = false` and clears the time, moving it back to the panel
- Alternatives in the same option group remain unaffected

### Files
- Edit: `src/components/timeline/EntryOverlay.tsx` -- "Move to ideas" button

---

## Technical Details

### Data Flow

```text
User creates entry
  |
  +--> "Add to ideas" --> is_scheduled=false, appears in panel
  |
  +--> Pick time --> is_scheduled=true, appears on timeline
  
User drags from panel to timeline
  |
  +--> Set is_scheduled=true, start_time, end_time
  |
  +--> Calculate travel to adjacent entries
  |
  +--> If conflict:
  |     |
  |     +--> Show ConflictResolver dialog
  |     |     |
  |     |     +--> User picks recommendation --> apply changes, lock
  |     |     |
  |     |     +--> User picks "figure it out" --> place with warning marker
  |     |
  +--> If no conflict:
        |
        +--> Place normally, show travel segments
```

### Updated Types (`src/types/trip.ts`)

- `Entry` gains: `is_scheduled`, `scheduled_day`, `option_group_id`
- New type: `OptionGroup { id, trip_id, label, created_at }`

### Migration Summary

| Change | Table | Column/Detail |
|--------|-------|--------------|
| Add column | entries | `is_scheduled` boolean default true |
| Add column | entries | `scheduled_day` integer nullable |
| Add column | entries | `option_group_id` uuid nullable |
| New table | option_groups | id, trip_id, label, created_at |
| RLS | option_groups | Same open policies as entries |

### New Files

| File | Purpose |
|------|---------|
| `src/components/timeline/IdeasPanel.tsx` | Side panel with unscheduled options |
| `src/components/timeline/IdeaCard.tsx` | Compact card for panel items |
| `src/components/timeline/ConflictResolver.tsx` | Step-by-step conflict dialog |
| `src/lib/conflictEngine.ts` | Conflict analysis and recommendation logic |
| `src/hooks/useTravelCalculation.ts` | Live travel time calculation hook |

### Edited Files

| File | Changes |
|------|---------|
| `src/types/trip.ts` | New fields on Entry, new OptionGroup type |
| `src/pages/Timeline.tsx` | Panel state, drag coordination, conflict state |
| `src/components/timeline/TimelineHeader.tsx` | Panel toggle button |
| `src/components/timeline/EntryForm.tsx` | "Add to ideas" option in When step |
| `src/components/timeline/EntryCard.tsx` | Alternatives badge, conflict marker |
| `src/components/timeline/EntryOverlay.tsx` | "Move to ideas" button, alternatives list |
| `src/components/timeline/CalendarDay.tsx` | Drop zone handlers |

