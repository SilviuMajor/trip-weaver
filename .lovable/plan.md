

# Explore Layout, Card Format, and Drag-to-Bin

## Overview
Three fixes: (1) Make ExploreView render as a sidebar panel on desktop instead of full-screen, (2) Redesign ExploreCard layout with name-left/rating-right, (3) Enable drag-to-delete from Planner sidebar.

---

## Fix 1: ExploreView as a Sidebar Panel on Desktop

Currently ExploreView renders as `fixed inset-0 z-50` (full-screen overlay). Within a trip context on desktop, it should instead render inside the same sidebar area as the Planner.

### Changes to `src/components/timeline/ExploreView.tsx`

Add a new prop `embedded?: boolean` that controls whether ExploreView renders as a full-screen overlay or as inline content (no fixed positioning, no background).

- When `embedded={true}`: return the content without the `fixed inset-0 z-50 bg-background` wrapper -- just a plain `div` with `flex flex-col h-full`
- When `embedded={false}` (default): keep current full-screen behavior
- The detail sheet (Dialog/Drawer) remains the same in both modes

### Changes to `src/components/timeline/CategorySidebar.tsx`

Add new props to CategorySidebar:
```typescript
exploreOpen?: boolean;
exploreContent?: React.ReactNode;
```

When `exploreOpen` is true, render `exploreContent` instead of the normal Planner content (header + PlannerContent). The back button in the sidebar header switches back to Planner view.

### Changes to `src/pages/Timeline.tsx`

Instead of rendering ExploreView as a standalone `fixed` overlay (lines 2614-2634), pass it as embedded content into CategorySidebar:

- When `exploreOpen` is true, also force `sidebarOpen = true` (auto-open the sidebar)
- Render ExploreView with `embedded={true}` and pass it as `exploreContent` to CategorySidebar
- Remove the standalone ExploreView render block (lines 2613-2635)
- On mobile, keep ExploreView as full-screen (Sheet) since the sidebar is already a Sheet

### Changes to `src/pages/GlobalExplore.tsx`

Add `max-w-2xl mx-auto` to the State 2 container so it doesn't stretch on wide screens.

### Changes to `src/pages/GlobalPlanner.tsx`

Add `max-w-2xl mx-auto` to the main container.

---

## Fix 2: ExploreCard Layout Redesign

### Changes to `src/components/timeline/ExploreCard.tsx`

Restructure the bottom content area:

**Current layout:** Name + address bottom-right, rating + price bottom-left
**New layout:**
- Bottom row left: Name (bold, text-sm, truncated), below it: address + price level
- Bottom row right: Rating (text-sm, bold) with star, review count below, planner icon below that
- Remove the separate "Name + address" block positioned at `bottom-8 right-0`
- Merge everything into the `bottom-0` content area

Approximate structure:
```
<div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2.5">
  <div className="flex items-end justify-between gap-2">
    {/* Left: name + details */}
    <div className="flex-1 min-w-0">
      <p className="truncate text-sm font-bold">{place.name}</p>
      <div className="flex items-center gap-1 mt-0.5">
        {address && <span className="truncate text-[10px]">address</span>}
        {priceDisplay && <span>dot</span>}
        {priceDisplay && <span>price</span>}
      </div>
      {compactHours && <p>hours</p>}
      {crossTripName && <p>cross trip</p>}
      {isInTrip && <span>Added badge</span>}
    </div>
    {/* Right: rating + planner icon */}
    <div className="shrink-0 flex flex-col items-end gap-1">
      {rating && (
        <div>
          <span className="text-sm font-bold">star rating</span>
          <span className="text-[9px]">(count)</span>
        </div>
      )}
      {planner icon button}
    </div>
  </div>
</div>
```

Remove the separate `absolute bottom-8 right-0` div entirely.

---

## Fix 3: Drag from Planner Sidebar to Delete Bin

### Changes to `src/pages/Timeline.tsx`

**New state:**
```typescript
const [sidebarDragActive, setSidebarDragActive] = useState(false);
```

**New effect** to detect HTML5 drag events (sidebar uses `e.dataTransfer.setData`):
```typescript
useEffect(() => {
  const handleDragStart = () => setSidebarDragActive(true);
  const handleDragEnd = () => {
    setSidebarDragActive(false);
    setBinHighlighted(false);
  };
  window.addEventListener('dragstart', handleDragStart);
  window.addEventListener('dragend', handleDragEnd);
  return () => {
    window.removeEventListener('dragstart', handleDragStart);
    window.removeEventListener('dragend', handleDragEnd);
  };
}, []);
```

**Update the bin element** (lines 2718-2732) to:
1. Show for sidebar drags (add `sidebarDragActive` to the visibility condition)
2. Add `onDragOver`, `onDragLeave`, `onDrop` handlers:

```typescript
onDragOver={(e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  setBinHighlighted(true);
}}
onDragLeave={() => setBinHighlighted(false)}
onDrop={async (e) => {
  e.preventDefault();
  setBinHighlighted(false);
  setSidebarDragActive(false);
  const entryId = e.dataTransfer.getData('text/plain');
  if (!entryId) return;
  const entry = entries.find(en => en.id === entryId);
  if (!entry) return;
  if (entry.is_locked) {
    sonnerToast.error("Can't delete -- unlock first");
    return;
  }
  const cat = entry.options[0]?.category;
  if (cat === 'flight' || cat === 'airport_processing') {
    sonnerToast.error("Can't delete flights by dragging");
    return;
  }
  await supabase.from('entries').delete().eq('id', entryId);
  sonnerToast.success(entry.options[0]?.name ? `Deleted ${entry.options[0].name}` : 'Entry deleted');
  fetchData();
}}
```

The bin visibility className changes from:
```
dragActiveEntryId && currentDragPhase === 'detached'
```
to:
```
(dragActiveEntryId && currentDragPhase === 'detached') || sidebarDragActive
```

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/timeline/ExploreView.tsx` | Add `embedded` prop; conditionally skip fixed wrapper |
| `src/components/timeline/CategorySidebar.tsx` | Add `exploreOpen`/`exploreContent` props; render explore content when active |
| `src/pages/Timeline.tsx` | Pass ExploreView as embedded sidebar content; add sidebar drag-to-bin logic |
| `src/components/timeline/ExploreCard.tsx` | Restructure: name left, rating right, single bottom row |
| `src/pages/GlobalExplore.tsx` | Add `max-w-2xl mx-auto` to State 2 container |
| `src/pages/GlobalPlanner.tsx` | Add `max-w-2xl mx-auto` to main container |

