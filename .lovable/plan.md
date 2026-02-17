

# ExploreCard Redesign and Planner Icon Update

## Overview
Two changes: (1) Redesign ExploreCard to match the visual language of EntryCard/SidebarEntryCard with a new layout, and (2) Replace the LayoutGrid icon with ClipboardList in Timeline.tsx.

---

## Change 1: ExploreCard Redesign

**File: `src/components/timeline/ExploreCard.tsx`**

Complete rewrite of the card layout to match EntryCard/SidebarEntryCard visual language:

**Background:** Replace the current diagonal fade gradient with the same one used in SidebarEntryCard:
```
linear-gradient(148deg, transparent 15%, rgba(10,8,6,0.20) 25%, rgba(10,8,6,0.65) 38%, rgba(10,8,6,0.96) 50%)
```
No-image fallback keeps the existing glossy hue-based gradient.

**Corner flag (top-left):** Unchanged -- category emoji on colored rounded corner.

**Planner button (top-right):** Replace the old bottom-right rating+icon combo. New 32px circle at `top-2 right-2`:
- Default state: `bg-orange-400/35 backdrop-blur-sm border border-orange-400/30`, ClipboardList icon (14px, white, opacity-0.9)
- Added state: `bg-orange-500 shadow-lg shadow-orange-500/30 scale-105`, Check icon (14px, white, strokeWidth 3)

**Remove:** The "Added" text badge and the old planner icon from the bottom area.

**Travel time pill (bottom-left):** Move from top-right to `bottom-2.5 left-2.5`. Use the same pill style as SidebarEntryCard duration pill:
```
background: rgba(255,255,255,0.12), backdropFilter: blur(8px), border: 1px solid rgba(255,255,255,0.08)
```

**Content area (bottom-right, right-aligned, max-width 72%):**

Stack in this order (all right-aligned):
1. Opening hours (text-[9px] text-white/55, red if closed) -- only if data exists
2. Name (text-sm font-bold text-white, truncated, text-shadow)
3. Address + price (text-[10px] text-white/60, format: "pin Address dot price")
4. Rating (text-[13px] font-bold text-amber-300 for star+number, text-[10px] text-white/45 for count)
5. Cross-trip indicator if applicable

**Card height:** h-[140px], same as current.

---

## Change 2: Planner Icon in Timeline.tsx

**File: `src/pages/Timeline.tsx`**

- Line 19: Change import from `{ Trash2, LayoutGrid }` to `{ Trash2, ClipboardList }`
- Line 2273: Change `<LayoutGrid className="h-5 w-5" />` to `<ClipboardList className="h-5 w-5" />`

This makes ClipboardList the consistent planner icon across: Timeline toggle, TripNavBar, EntrySheet, CategorySidebar, and ExploreCard.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/timeline/ExploreCard.tsx` | Full layout redesign: diagonal fade, orange planner btn top-right, travel pill bottom-left, right-aligned content stack, larger amber rating |
| `src/pages/Timeline.tsx` | Replace LayoutGrid with ClipboardList (import + usage) |

