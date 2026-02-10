
# Insert Button + Smart Hotel Wizard

## Overview

Two features:
1. **Insert button** on sidebar entry cards -- opens a "pick a day" dialog, then closes the sidebar and scrolls the timeline to that day with the entry ready for drag-placement.
2. **Hotel Wizard** -- a multi-step dialog that launches when adding a hotel, asking which hotel (via Google Places), which nights, return/leave times, and whether there is a second hotel. Creates one entry per night automatically.

---

## 1. Insert Button on Sidebar Cards

### Flow
1. User taps "Insert" icon on any sidebar entry card
2. A small popover/dialog appears: "Which day?" with a list of trip days (Day 1, Day 2, etc.)
3. User picks a day
4. Sidebar closes
5. Timeline scrolls to that day
6. The entry is duplicated as a new scheduled entry placed at a default time slot on that day
7. User can then drag/resize it into the exact position

### Implementation

**SidebarEntryCard.tsx** -- Add an "Insert" button (ArrowRightToLine or LogIn icon) next to the existing Copy button. Fires `onInsert(entry)`.

**CategorySidebar.tsx** -- Accept new `onInsert` prop, pass it through to each card.

**Timeline.tsx**:
- Add `onInsert` handler that opens a small day-picker dialog
- On day selection: create a duplicate entry at the category's default time on that day (scheduled), close sidebar, scroll to that day
- New state: `insertDayPickerOpen`, `insertingEntry`

**New component: `DayPickerDialog.tsx`** -- Simple dialog showing trip days as a list. Returns selected day index.

---

## 2. Hotel Wizard

### Flow
When user clicks "+" on the Hotel category (or selects Hotel in the entry form), instead of the standard entry form, a dedicated multi-step wizard opens:

**Step 1 -- Pick Hotel**: Google Places autocomplete for hotel name. Auto-fills location, coordinates, images, website.

**Step 2 -- Select Nights**: Shows all trip days as checkboxes. User selects which nights they are staying (e.g., nights of Day 1, 2, 3 = check-in evening Day 1, check-out morning Day 4). Multi-select.

**Step 3 -- Set Times**: Two time pickers:
- "When do you usually get back in the evening?" (default: 22:00)
- "When do you want to leave in the morning?" (default: 08:00)

**Step 4 -- Another Hotel?**: "Do you have another hotel?" Yes/No. If yes, loops back to Step 1 for the second hotel (with remaining unselected nights pre-highlighted). If no, confirms and creates entries.

### What Gets Created
- One `entry` + `entry_option` per selected night
- Each entry: `start_time` = evening return time on that day, `end_time` = morning leave time on the next day
- `is_scheduled = true`, `category = 'hotel'`
- All entries share the same hotel name, location, photos
- Each entry's `scheduled_day` is set to the night's day index

### Implementation

**New component: `HotelWizard.tsx`**:
- Props: `open`, `onOpenChange`, `tripId`, `trip`, `onCreated`
- 4-step wizard dialog using the existing Dialog component
- Step 1: PlacesAutocomplete for hotel search
- Step 2: Checkbox grid of trip nights
- Step 3: Two time inputs (evening return, morning leave)
- Step 4: "Add another hotel?" prompt
- On confirm: batch-inserts entries + options + images into the database

**Modified: `Timeline.tsx`**:
- When `onAddEntry('hotel')` is called from the sidebar, open HotelWizard instead of EntryForm
- New state: `hotelWizardOpen`

**Modified: `CategorySidebar.tsx`**:
- No changes needed (already fires `onAddEntry(cat.id)`)

---

## 3. File Summary

| File | Action |
|------|--------|
| `src/components/timeline/SidebarEntryCard.tsx` | Add "Insert" button next to Copy |
| `src/components/timeline/CategorySidebar.tsx` | Pass through `onInsert` prop |
| `src/components/timeline/DayPickerDialog.tsx` | New -- simple day selection dialog |
| `src/components/timeline/HotelWizard.tsx` | New -- multi-step hotel setup wizard |
| `src/pages/Timeline.tsx` | Add insert handler, day picker state, hotel wizard routing |

No database changes needed.

---

## 4. Technical Details

### DayPickerDialog.tsx
- Props: `open`, `onOpenChange`, `days` (array of day labels like "Day 1 - Mon 14 Jul"), `onSelectDay(dayIndex: number)`
- Simple Dialog with a scrollable list of day buttons
- Each button shows the day label; clicking it fires the callback and closes

### HotelWizard.tsx
- Uses existing `PlacesAutocomplete` component for hotel search
- Night selection: renders a grid of toggle buttons for each trip night (e.g., "Night of Day 1", "Night of Day 2")
- Time pickers use standard HTML time inputs
- "Another hotel?" step uses two large buttons (Yes / No)
- On completion, batch creates entries via Supabase:
  ```
  For each selected night:
    1. Calculate start_time = selected day + evening return time (in trip timezone)
    2. Calculate end_time = next day + morning leave time (in trip timezone)
    3. Insert entry (is_scheduled: true, scheduled_day: dayIndex)
    4. Insert entry_option (name, category: 'hotel', location, coords, etc.)
    5. Insert option_images for auto-fetched photos
  ```
- If "another hotel" is selected, wizard resets to Step 1 but keeps track of already-assigned nights (greys them out)

### Insert Handler in Timeline.tsx
```
handleInsert(entry):
  1. Open DayPickerDialog with trip days
  2. On day selected:
     a. Clone entry (same as handleDuplicate logic)
     b. Set clone as is_scheduled: true
     c. Set start_time/end_time to category defaults on selected day
     d. Close sidebar
     e. Scroll to that day in the timeline
     f. Refresh data
     g. Toast: "Entry placed on Day X"
```
