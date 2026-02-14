

# Add Planner FAB Button + Drop Target

## Overview
Add a permanent Planner toggle button above the existing + FAB, and make it a drop target during hold-to-detach drag (alongside the existing delete bin).

## Changes

### File: `src/pages/Timeline.tsx`

**1. Import `LayoutGrid`** (line 17): Add `LayoutGrid` to the lucide-react import alongside `Trash2`.

**2. New state + ref** (near line 164, after bin state):
```typescript
const plannerFabRef = useRef<HTMLButtonElement>(null);
const [plannerFabHighlighted, setPlannerFabHighlighted] = useState(false);
```

**3. Expand proximity detection** (lines 1620-1644): Replace the `checkBinProximity` function with a `checkProximity` function that checks both the bin and the planner button:
- Bin check stays the same
- Add planner button distance check using `plannerFabRef`, also with 60px threshold
- Sets `setPlannerFabHighlighted` accordingly

**4. Reset planner highlight in drag callbacks** (lines 2230-2236): In both `onDragActiveChange` and `onDetachedDragChange`, add `setPlannerFabHighlighted(false)` when drag ends.

**5. Expand `onDetachedDrop`** (lines 2238-2256): After the existing `binHighlighted` branch, add an `else if (plannerFabHighlighted)` branch that:
- Guards locked entries with toast "Can't move -- unlock first"
- Guards flights/airport_processing with toast "Can't move flights to Planner"
- Otherwise calls `supabase.from('entries').update({ is_scheduled: false, scheduled_day: null }).eq('id', entryId)` then `fetchData()` and toasts "Moved to Planner"
- Resets `setPlannerFabHighlighted(false)` at the end

**6. Render Planner FAB button** (after the + FAB button, around line 2122): Add a `<button>` at `fixed bottom-24 right-6 z-40` with `LayoutGrid` icon. Three visual states:
- **During drag**: primary-colored drop target (`bg-primary/60`), scales up + brightens when card is near (`bg-primary scale-125`)
- **Not dragging, sidebar open**: filled primary (`bg-primary text-primary-foreground`)
- **Not dragging, sidebar closed**: outlined (`bg-background border border-border text-muted-foreground`)

On click (only when not dragging): toggles `setSidebarOpen(!sidebarOpen)`.

## Files changed
1. `src/pages/Timeline.tsx` -- new state, proximity detection expansion, planner FAB rendering, drop handling

## What does NOT change
- Bin icon behavior (left side, red)
- Desktop drag/resize
- Existing "Send to Planner" in card overview
- Planner sidebar itself
- Touch drag from Planner to timeline
