

# Entries Bank Rework + Opacity & Filtering

## Overview

Rework the "All Entries" sidebar into an **Entries Bank** -- showing only original entries (one per unique event), with usage count badges, flight restrictions, 70% opacity for scheduled items, and filter tabs.

---

## 1. Bank Behavior: Show Only Originals with Count Badge

### Concept

- The bank shows each **unique entry** once (the original)
- When an entry has been placed on the timeline (or duplicated onto it), a **count badge** appears on the card (e.g., "x2" if used twice)
- Dragging from the bank always **creates a new copy** on the timeline
- Flights are the exception: they cannot be duplicated (see section 2)

### How to detect duplicates

Entries are currently independent rows. To group "originals" and "copies", match entries by their first option's `name` + `category` combination within the same trip. This avoids needing a new DB column.

### Implementation

**File: `src/components/timeline/CategorySidebar.tsx`**

- Add deduplication logic in the `grouped` useMemo:
  - For each category group, deduplicate entries by `option.name + option.category`
  - Keep the first (oldest by `created_at`) as the "original"
  - Count how many entries share the same name+category = usage count
  - Track how many of those are `is_scheduled === true` = scheduled count
- Pass `usageCount` and `scheduledCount` to each `SidebarEntryCard`

**File: `src/components/timeline/SidebarEntryCard.tsx`**

- Accept new props: `usageCount?: number`, `scheduledCount?: number`
- When `usageCount > 1`, show a small badge (e.g., "x2") in the top-right corner of the card

---

## 2. Flight Restriction

### Behavior

- Flight entries **always appear** in the bank
- Once scheduled, their card shows at 70% opacity (like other scheduled entries)
- They are **NOT draggable** and the duplicate/insert buttons are hidden
- Tapping a flight card opens the entry overlay (existing `onCardTap` behavior) so users can view/edit details
- The drag handle icon is hidden for flights

### Implementation

**File: `src/components/timeline/SidebarEntryCard.tsx`**

- Accept new prop: `isFlight?: boolean`
- When `isFlight && isScheduled`:
  - Set `draggable={false}`, hide `GripVertical`, hide duplicate/insert buttons
  - Show a small "Scheduled" label or checkmark instead of action buttons
  - Card is still clickable (opens overlay)

**File: `src/components/timeline/CategorySidebar.tsx`**

- When rendering flight entries, pass `isFlight={true}` to `SidebarEntryCard`
- Do NOT pass `onDuplicate` or `onInsert` for flight entries

---

## 3. Opacity Change: 50% to 70%

### Implementation

**File: `src/components/timeline/SidebarEntryCard.tsx`**

- Change `isScheduled && 'opacity-50'` to `isScheduled && 'opacity-70'`
- Since Tailwind doesn't have `opacity-70` by default, use inline style: `style={{ opacity: isScheduled ? 0.7 : 1 }}`

---

## 4. Filter Tabs

### Behavior

Three tabs at the top of the bank, below the header:
- **All** -- shows every entry (default)
- **Ideas** -- shows only unscheduled entries (`is_scheduled === false`)
- **Scheduled** -- shows only scheduled entries

The active tab is highlighted. Category sections that have no entries in the current filter are hidden entirely (no empty sections).

### Implementation

**File: `src/components/timeline/CategorySidebar.tsx`**

- Add state: `activeFilter: 'all' | 'ideas' | 'scheduled'` (default: `'all'`)
- Render 3 tab buttons below the header
- Apply filter before grouping by category:
  - `'all'`: show all entries
  - `'ideas'`: filter to `is_scheduled === false`
  - `'scheduled'`: filter to `is_scheduled !== false`
- Hide category sections with 0 entries after filtering

---

## 5. Drag from Bank Creates Copy (not move)

### Current behavior

Currently dragging from sidebar sets the entry ID in dataTransfer, and `handleDropOnTimeline` updates that entry's `is_scheduled` to `true`. This **moves** the entry.

### New behavior

Dragging from the bank should **create a copy** (like the existing `handleDuplicate` + schedule logic), not move the original. The original stays in the bank.

Exception: if the entry is currently unscheduled and has never been used, the first drag should move it (schedule it). Subsequent drags create copies.

For flights: dragging is disabled entirely, so this doesn't apply.

### Implementation

**File: `src/pages/Timeline.tsx`**

- Modify `handleDropOnTimeline`:
  - Check if entry is a flight -- if so, block the drop
  - Check `usageCount` -- if the entry is already scheduled somewhere, create a copy instead of moving
  - If it's an unscheduled entry being placed for the first time, move it (current behavior)

---

## File Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/timeline/CategorySidebar.tsx` | Edit | Deduplication logic, filter tabs, flight handling, hide empty sections |
| `src/components/timeline/SidebarEntryCard.tsx` | Edit | Usage count badge, flight restrictions, opacity 70%, isFlight prop |
| `src/pages/Timeline.tsx` | Edit | Drop handler: copy vs move logic, flight block |

No new files needed. No database changes.

---

## Technical Details

### Deduplication logic (CategorySidebar)

```text
For each category group:
  1. Group entries by (option.name + option.category)
  2. For each group:
     - Pick the entry with earliest created_at as "original"
     - Count total entries in group = usageCount
     - Count entries where is_scheduled = true = scheduledCount
  3. Render only the "original" card with usageCount badge
```

### Filter tabs markup

```text
[All (15)] [Ideas (4)] [Scheduled (11)]

Rendered as small rounded buttons/tabs in a row below the header.
Active tab: bg-primary/10 text-primary border-primary/20
Inactive tab: text-muted-foreground
```

### Drop handler change (Timeline.tsx)

```text
handleDropOnTimeline(entryId, day, hourOffset):
  1. Find the entry
  2. If entry.options[0].category === 'flight' -> toast error, return
  3. If entry.is_scheduled === true (already on timeline):
     -> Create a COPY (clone entry + options + images, set new times, is_scheduled: true)
  4. If entry.is_scheduled === false (first placement):
     -> MOVE it (update existing entry, set is_scheduled: true)
  5. Run travel calculation + conflict detection as before
```

### Flight card in bank (visual)

```text
+---------------------------+
| [check icon] BA 1234      |  <- no grip handle
| LHR -> AMS                |
| Day 2         2h 30m      |  <- "Day 2" badge, no action buttons
+---------------------------+
  opacity: 0.7, cursor: default (not grab)
```

