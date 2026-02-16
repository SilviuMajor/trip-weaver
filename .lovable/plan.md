

# Planner Layout Redesign — PlannerContent + Horizontal Scroll

## Overview
Extract shared planner content into a reusable `PlannerContent.tsx`, replace filter tabs with an unscheduled-first layout with a collapsible "On timeline" section, switch cards to Netflix-style horizontal scroll rows, and add a search placeholder button.

## Step 1: Add scrollbar-hide CSS utility

In `src/index.css`, add:
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

## Step 2: Create `src/components/timeline/PlannerContent.tsx`

### Props
```typescript
interface PlannerContentProps {
  entries: EntryWithOptions[];
  trip: Trip | null;
  isEditor: boolean;
  onCardTap: (entry: EntryWithOptions) => void;
  onAddEntry?: (categoryId: string) => void;
  onDragStart: (e: React.DragEvent, entry: EntryWithOptions) => void;
  onDuplicate?: (entry: EntryWithOptions) => void;
  onInsert?: (entry: EntryWithOptions) => void;
  onTouchDragStart?: (entry: EntryWithOptions, initialPosition: { x: number; y: number }) => void;
}
```

### Consolidated logic (moved from both CategorySidebar and Planner)
- `allCategories` memo: build from `PICKER_CATEGORIES` + trip custom presets
- `deduplicatedMap` memo with hotel-aware dedup (use CategorySidebar's more complete version with `hotel_id` grouping)
- `getFilteredOriginals` helper
- Two separate groupings:
  - `unscheduledGrouped`: entries where `is_scheduled === false`, grouped by category
  - `scheduledGrouped`: entries where `is_scheduled !== false`, grouped by category
- `scheduledCount`: count of scheduled entries excluding `airport_processing`, `transport`, `transfer`

### Layout structure
1. No filter tabs
2. **Unscheduled section** (top): category rows with only `is_scheduled === false` entries. Empty categories hidden except `hotel` (always show).
3. **"On timeline (N)" collapsible** (bottom): uses `Collapsible` from `@/components/ui/collapsible`. Default collapsed. Shows scheduled entries grouped by category when expanded. Header: "On timeline ({scheduledCount})" with a `ChevronDown` icon that rotates when open.

### Category row rendering (shared helper)
For each category with entries:
```
🍽️ LUNCH (2)                    [+]
<horizontal scroll container>
  <fixed-width card> <fixed-width card> ...
</horizontal scroll container>
```

- Horizontal scroll container: `flex gap-2 overflow-x-auto scrollbar-hide` with `-webkit-overflow-scrolling: touch`
- Each card wrapper: `w-[160px] shrink-0` on mobile, `w-[180px] shrink-0` on desktop (use `useIsMobile`)
- SidebarEntryCard itself unchanged — just wrapped in the fixed-width div
- The "Other" category section uses the same horizontal layout

### Search button
In the component's top area (not a sticky header — the header belongs to the parent), render a `Search` icon button. On tap, show toast: "Explore coming soon". Position it as part of content, or expose via a render prop / slot. Since CategorySidebar has its own header and Planner has its own header, the search button will be rendered as the first element inside PlannerContent, as a small bar with the search icon on the right.

Actually, looking at the current layout: CategorySidebar has a header with "Planner" title. The search button should go next to that. I'll add an optional `renderHeader` slot or just include a minimal toolbar row at the top of PlannerContent with the search icon.

Simplest approach: PlannerContent renders a small toolbar row at the top with a search button on the right. The "+" per-category buttons remain on each category row.

## Step 3: Update `CategorySidebar.tsx`

- Remove: `FilterTab` type, `activeFilter` state, `allCategories` memo, `filteredEntries` memo, `deduplicatedMap` memo, `getFilteredOriginals`, `grouped` memo, count calculations, `filterTabs`, and all the category rendering JSX
- Keep: Sheet/panel wrapper, header with back arrow and "Planner" title, `open`/`onOpenChange` props, mobile Sheet vs desktop panel logic, `compact`/`hiddenForDrag` props
- Replace the filter tabs + category sections area with:
  ```tsx
  <PlannerContent
    entries={entries}
    trip={trip}
    isEditor={!!onAddEntry}
    onCardTap={(e) => onCardTap?.(e)}
    onAddEntry={onAddEntry}
    onDragStart={onDragStart}
    onDuplicate={onDuplicate}
    onInsert={onInsert}
    onTouchDragStart={onTouchDragStart}
  />
  ```
- Remove the debug console.log

## Step 4: Update `Planner.tsx`

- Remove: `FilterTab` type, `activeFilter` state, `allCategories` memo, `filteredEntries` memo, `deduplicatedMap` memo, `getFilteredOriginals`, `grouped` memo, count calculations, `filterTabs`, filter tabs JSX, and the category sections JSX
- Remove imports: `PREDEFINED_CATEGORIES`, `CategoryDef`, `SidebarEntryCard`, `cn`
- Add import: `PlannerContent`
- Replace the filter tabs + `<div className="mx-auto max-w-2xl ...">` section with:
  ```tsx
  <PlannerContent
    entries={entries}
    trip={trip}
    isEditor={isEditor}
    onCardTap={handleCardTap}
    onAddEntry={(catId) => {
      if (catId === 'hotel') { setHotelWizardOpen(true); return; }
      setPrefillCategory(catId);
      setSheetMode('create');
      setSheetEntry(null);
      setSheetOption(null);
      setSheetOpen(true);
    }}
    onDragStart={() => {}}
  />
  ```
- Keep: data fetching, EntrySheet, HotelWizard, FAB, TimelineHeader, TripNavBar

## Technical Notes

- The `isEditor` prop on PlannerContent controls whether "+" buttons and the search button appear (search is visible to all, but "+" is editor-only — same as current behavior)
- `alwaysShowCategories = ['hotel']` logic preserved: hotel row shows in the unscheduled section even when empty
- Hotel dedup uses `hotel_id` grouping (the more complete version from CategorySidebar)
- The `onAddEntry` callback is optional — when not provided, no "+" buttons render (same as current)
- Card height stays at current SidebarEntryCard dimensions — the fixed width creates a nice card aspect ratio

