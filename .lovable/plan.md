

# Category Sidebar + Duplicate Entry

## Overview

Replace the current "Ideas" sidebar with a comprehensive **Category Sidebar** that shows ALL entries (both scheduled and unscheduled) grouped by category. Each category section has an "Add" button, entries show a status tag ("Day 2", "Idea"), and entries can be duplicated and dragged onto the timeline multiple times. A usage count tracks how many times each entry has been placed.

---

## 1. Duplicate (Copy) Entry

### How it works
- Each entry card in the sidebar gets a "Copy" button (duplicate icon)
- Clicking it creates a new `entries` row + `entry_options` row with the same data (name, category, website, location, coordinates, photos) but `is_scheduled = false`
- The copy appears in the sidebar immediately as a new unscheduled entry
- The user can then drag it onto any day/time

### Drag-to-place behavior change
- Currently, dragging an idea onto the timeline **moves** it (sets `is_scheduled = true`)
- New behavior: dragging from the sidebar **creates a placement** but the entry stays in the sidebar
- A `placement_count` is tracked visually -- showing how many times an entry has been placed on the timeline
- The sidebar entry shows "Used x2" or similar when placed multiple times

**Implementation note**: Since the current data model ties one entry to one time slot, duplicating will create a new entry row each time. The sidebar card will have a "Copy" action that clones the entry + option + images. The original stays put.

---

## 2. New Category Sidebar (replaces IdeasPanel)

### Structure

All predefined categories are always visible, each as a section:

```text
------------------------------
| Flights                 [+] |
|   Entry A       Day 1       |
|   Entry B       Idea        |
|                              |
| Hotels                  [+] |
|   Entry C       Day 1-3     |
|                              |
| Breakfast               [+] |
|   (empty)                   |
|                              |
| Lunch                   [+] |
|   Entry D       Day 2       |
|   Entry E       Idea        |
| ...                          |
------------------------------
```

### Key features
- **All categories shown** (Flights, Hotels, Breakfast, Lunch, Dinner, Drinks, Activities, Sightseeing, Shopping, Transfers, Home, Airport) even when empty
- **Custom categories** from `trip.category_presets` also shown
- **"+" button** next to each category header opens the EntryForm pre-filled with that category
- **Status tag** on each entry card:
  - Scheduled entries show "Day X" (e.g., "Day 2")
  - Unscheduled entries show "Idea"
- **Copy button** on each card to duplicate the entry
- **Draggable cards** -- drag from sidebar onto timeline to place
- **Entry count** per category shown in the header (e.g., "Hotels (2)")

### Data source
- Uses ALL entries (`entries` table for the trip), not just unscheduled ones
- Groups by `entry_options[0].category`
- Entries without a matching predefined category go into an "Other" section at the bottom

---

## 3. Files to Change

### New file: `src/components/timeline/CategorySidebar.tsx`
Replaces `IdeasPanel`. Contains:
- Props: `open`, `onOpenChange`, `entries` (ALL entries), `trip`, `onDragStart`, `onCardTap`, `onAddEntry(categoryId)`, `onDuplicate(entry)`
- Renders a scrollable list of category sections
- Each section: header with emoji + name + count + "+" button, then entry cards
- Each card: name, location snippet, status tag ("Day X" or "Idea"), copy button, draggable

### Modified: `src/components/timeline/IdeaCard.tsx` -> rename/evolve to `SidebarEntryCard.tsx`
- Add status tag (scheduled day or "Idea")
- Add copy/duplicate button
- Keep drag handle and click-to-open behavior

### Modified: `src/pages/Timeline.tsx`
- Replace `IdeasPanel` import with `CategorySidebar`
- Pass ALL entries (not just unscheduled) to the sidebar
- Add `onDuplicate` handler that clones an entry + option + images in the database
- Update the `onAddEntry` handler to pre-select category in EntryForm
- Mobile FAB icon changes from lightbulb to a list/menu icon
- Badge count on FAB shows total unscheduled count

### Modified: `src/components/timeline/EntryForm.tsx`
- Accept an optional `prefillCategory` prop so the "+" button in the sidebar can skip the category step
- When `prefillCategory` is set, start on the "details" step with category pre-selected

### Deleted: `src/components/timeline/IdeasPanel.tsx`
- Fully replaced by CategorySidebar

---

## 4. Duplicate Entry Logic (in Timeline.tsx)

```text
handleDuplicate(entry):
  1. Insert new row in `entries` table (same trip_id, is_scheduled=false, placeholder times)
  2. For each option in entry.options:
     - Insert new row in `entry_options` with same fields, pointing to new entry_id
     - Copy all `option_images` rows for that option
  3. Refresh data
  4. Show toast: "Entry duplicated"
```

---

## 5. Summary

| File | Action |
|------|--------|
| `src/components/timeline/CategorySidebar.tsx` | New -- category-grouped sidebar with all entries |
| `src/components/timeline/SidebarEntryCard.tsx` | New -- individual entry card with status tag + copy button |
| `src/pages/Timeline.tsx` | Update -- swap IdeasPanel for CategorySidebar, add duplicate handler, pass prefillCategory |
| `src/components/timeline/EntryForm.tsx` | Update -- accept `prefillCategory` prop to skip category step |
| `src/components/timeline/IdeasPanel.tsx` | Delete -- replaced by CategorySidebar |
| `src/components/timeline/IdeaCard.tsx` | Delete -- replaced by SidebarEntryCard |

No database changes needed -- all existing columns support this.

