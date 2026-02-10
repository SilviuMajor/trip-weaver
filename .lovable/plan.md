
# Insert Button + Smart Hotel Wizard — IMPLEMENTED

## Status: ✅ Complete

## What was built

### 1. Insert Button on Sidebar Cards
- **SidebarEntryCard.tsx**: Added `ArrowRightToLine` insert button (appears on hover, next to Copy)
- **CategorySidebar.tsx**: Passes `onInsert` prop through to all cards
- **DayPickerDialog.tsx** (new): Simple dialog listing trip days for selection
- **Timeline.tsx**: `handleInsert` opens day picker → clones entry onto selected day → closes sidebar → scrolls to day

### 2. Hotel Wizard
- **HotelWizard.tsx** (new): 4-step wizard dialog:
  - Step 1: PlacesAutocomplete hotel search (auto-fills name, location, coords, photos)
  - Step 2: Night selection checkboxes
  - Step 3: Evening return / morning leave time pickers (defaults: 22:00 / 08:00)
  - Step 4: "Add another hotel?" with loop support (greys out assigned nights)
- Creates one entry per night, each spanning evening → next morning
- **Timeline.tsx**: Routes `onAddEntry('hotel')` to HotelWizard instead of EntryForm

### 3. CalendarDay.tsx
- Added `dayIndex` prop + `data-day-index` attribute for scroll targeting

## Files Changed
| File | Action |
|------|--------|
| `src/components/timeline/SidebarEntryCard.tsx` | Added Insert button |
| `src/components/timeline/CategorySidebar.tsx` | Added `onInsert` prop passthrough |
| `src/components/timeline/DayPickerDialog.tsx` | New component |
| `src/components/timeline/HotelWizard.tsx` | New component |
| `src/components/timeline/CalendarDay.tsx` | Added `dayIndex` prop |
| `src/pages/Timeline.tsx` | Wired up insert, day picker, hotel wizard |
