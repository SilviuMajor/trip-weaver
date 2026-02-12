
# Fix Navigation, Planner Layout, Header, and Card Readability

## 1. Replace TripNavBar with Tab Bar + FAB

**File: `src/components/timeline/TripNavBar.tsx`** -- Rewrite completely

Replace the current 3-button switching nav with a simple 2-tab bar:
- Two tabs always visible: **Timeline** (Calendar icon) and **Planner** (ClipboardList icon)
- Active tab: bold text, orange underline/highlight using the app's warm palette
- Inactive tab: muted/grey text
- No "Live" tab -- remove entirely
- No + button in the bar -- it moves to a FAB

Props simplified:
- `currentPage: 'timeline' | 'planner'`
- `tripId: string`
- `onTabChange: (page: 'timeline' | 'planner') => void`

On Timeline page: tapping "Planner" tab opens the sidebar panel (not navigating to `/planner` route). On Planner page: not used (Planner becomes a side panel, not a separate route).

**File: `src/pages/Timeline.tsx`** -- Update TripNavBar usage

- Replace `TripNavBar` with the new tab bar component
- "Planner" tab toggles `sidebarOpen` state (opens/closes CategorySidebar)
- "Timeline" tab closes the sidebar if open
- Add a FAB (floating action button): fixed `bottom-6 right-6`, circular, orange (`bg-primary`), shadow-lg, with Plus icon. `onClick` triggers the existing add entry flow. Rendered alongside UndoRedoButtons.

## 2. Planner as Side Panel (not full page)

**File: `src/App.tsx`** -- Remove the `/trip/:tripId/planner` route. Remove the `/trip/:tripId/live` route (Live removed from nav).

**File: `src/pages/Planner.tsx`** -- Keep file but it will no longer be routed to. (Or delete the route; the Planner content lives inside `CategorySidebar` already.)

The Planner functionality is already implemented as `CategorySidebar` in `Timeline.tsx`:
- **Desktop/tablet**: `CategorySidebar` renders as a side panel (already does this -- `w-[320px]` border-l). Change width to `w-[40%]` for ~40% screen width.
- **Mobile**: `CategorySidebar` already renders as a `Sheet` sliding from the right. Change width to `w-[60%]` (currently `w-full sm:w-[380px]`). The Sheet already has a dimmed backdrop and tap-to-close behavior.

**File: `src/components/timeline/CategorySidebar.tsx`**
- Desktop panel: change `w-[320px]` to `w-[40vw] max-w-[500px]`
- Mobile sheet: change `w-full sm:w-[380px]` to `w-[60vw] min-w-[280px]`
- The panel already has independent scroll (`overflow-y-auto`)

When "Planner" tab is active, `sidebarOpen = true`. When "Timeline" tab is tapped, `sidebarOpen = false`.

## 3. Clean Up Header

**File: `src/components/timeline/TimelineHeader.tsx`**

Remove the entire "Organizer tools row" (lines 126-140) -- the lock icon, auto-transport, and weather buttons. Keep only:
- Left: Trip icon + name + welcome message
- Right: Settings cog + exit button

These organizer tools will be accessible from Trip Settings page instead.

However, this removes functionality (lock voting, auto-transport, weather fetch). Since the user says "These are legacy and cluttering the UI", I'll remove them from the header. The auto-transport and weather functions are still callable from the code; they just won't have header buttons. Lock toggle can be accessed from Trip Settings.

Props to remove from TimelineHeader: `onAutoGenerateTransport`, `autoTransportLoading`, `scheduledEntries`.

## 4. Strengthen Card Dark Gradient

**File: `src/components/timeline/EntryCard.tsx`**

Both full-size and condensed cards already have `bg-gradient-to-t from-black/70 via-black/30 to-transparent`. Strengthen to `from-black/80 via-black/40 to-black/5` for better text legibility.

**File: `src/components/timeline/SidebarEntryCard.tsx`**

Currently has `bg-gradient-to-r from-black/70 via-black/50 to-black/30`. Strengthen to `from-black/80 via-black/50 to-black/30`.

## 5. "Planner" Naming

Already done in previous update. Verify no remaining "Trip Events" references exist.

## Summary of File Changes

| File | Change |
|---|---|
| `src/components/timeline/TripNavBar.tsx` | Rewrite: 2-tab bar (Timeline + Planner), no Live, no + button |
| `src/pages/Timeline.tsx` | Update tab bar usage, add FAB, tab controls sidebar open/close, remove auto-transport/weather header props |
| `src/components/timeline/TimelineHeader.tsx` | Remove organizer tools row, simplify props |
| `src/components/timeline/CategorySidebar.tsx` | Desktop: `w-[40vw]`, Mobile: `w-[60vw]` |
| `src/components/timeline/EntryCard.tsx` | Strengthen gradient overlay on image cards |
| `src/components/timeline/SidebarEntryCard.tsx` | Strengthen gradient overlay |
| `src/App.tsx` | Remove `/planner` and `/live` routes |

## Technical Notes

- The FAB uses `fixed bottom-6 right-6 z-40` with `h-14 w-14 rounded-full bg-primary shadow-lg`
- Tab bar stays sticky below header with `sticky top-[57px] z-20`
- Active tab uses a bottom border highlight (`border-b-2 border-primary text-primary font-semibold`)
- The Planner panel opens/closes via the existing `sidebarOpen` state in Timeline.tsx
- UndoRedoButtons positioning may need adjustment to avoid overlapping the FAB (offset left or stack vertically)
