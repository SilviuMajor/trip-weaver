
# Add Live Panel + 3-Panel Desktop Layout

## Overview

Add a "Live" tab to the navigation bar and implement a 3-panel desktop layout where Timeline is always the centre panel, with Live and Planner as toggleable side panels. On mobile, Live becomes a full-screen takeover.

## 1. Update TripNavBar to 3 tabs

**File: `src/components/timeline/TripNavBar.tsx`**

- Add a third tab: **Live** (Radio icon) on the left, **Timeline** (Calendar icon) in the centre, **Planner** (ClipboardList icon) on the right
- Change props to accept `activeTab` as an object `{ live: boolean; planner: boolean }` (since on desktop both can be active simultaneously), plus `currentView` for mobile (only one active at a time)
- Actually, simpler approach: keep `activeTab` but accept a new prop `livePanelOpen: boolean` and `plannerPanelOpen: boolean` to control highlight states
- On desktop: Live and Planner tabs act as toggles (click to open/close their panels). Timeline tab closes both panels. Multiple tabs can appear "active".
- On mobile: tabs are mutually exclusive. Tapping Live shows full-screen Live. Tapping Timeline returns to timeline. Tapping Planner opens the 60% overlay.

New props:
```
interface TripNavBarProps {
  liveOpen: boolean;
  plannerOpen: boolean;
  isMobile: boolean;
  onToggleLive: () => void;
  onTogglePlanner: () => void;
  onTimelineOnly: () => void;
}
```

## 2. Update LivePanel for desktop side panel + mobile full-screen

**File: `src/components/timeline/LivePanel.tsx`**

- Enhance the placeholder content: add subtitle "Live trip tracking, weather, and real-time updates", add a pulse animation on the Radio icon, use warm color palette
- Desktop: renders as a left-side panel with `border-r`, width controlled by parent
- Mobile: instead of a Sheet, render as a full-screen overlay (absolutely positioned, covering the main content area but keeping the header + tab bar visible). The tab bar stays at top so user can navigate back.

Mobile implementation: when `open && isMobile`, render a `div` that fills the remaining viewport below the tab bar with the Live content. This replaces the timeline content visually.

## 3. Update Timeline.tsx layout to support 3 panels

**File: `src/pages/Timeline.tsx`**

Add `liveOpen` state alongside existing `sidebarOpen` state.

Layout structure change for the main content area (line ~1438):

```
<div className="flex flex-1 overflow-hidden">
  {/* Desktop Live panel */}
  {!isMobile && <LivePanel open={liveOpen} onOpenChange={setLiveOpen} />}
  
  {/* Timeline (always visible on desktop, hidden on mobile when Live is active) */}
  <main className="flex-1 overflow-y-auto pb-20" style={dynamicWidth}>
    ...calendar days...
  </main>
  
  {/* Desktop Planner panel */}
  {!isMobile && <CategorySidebar ... />}
</div>

{/* Mobile: Live full-screen takeover */}
{isMobile && liveOpen && <LivePanel ... />}

{/* Mobile: Planner overlay (existing Sheet behavior) */}
{isMobile && <CategorySidebar ... />}
```

Desktop panel widths (using CSS transitions for smooth animation):
- Live panel: `w-[30%]` when only Live is open, `w-[25%]` when both panels are open
- Planner panel: `w-[30%]` when only Planner is open, `w-[25%]` when both panels are open
- Timeline: takes remaining space (`flex-1`)

Update TripNavBar usage:
- Pass `liveOpen`, `plannerOpen: sidebarOpen`, `isMobile`
- `onToggleLive`: toggles `liveOpen` state. On mobile, also closes planner and sets a "mobileView" state.
- `onTogglePlanner`: toggles `sidebarOpen`. On mobile, closes live view.
- `onTimelineOnly`: closes both panels. On mobile, returns to timeline view.

Mobile behavior:
- Add `mobileView` state: `'timeline' | 'live'` (Planner is an overlay, not a full view)
- When `mobileView === 'live'`, hide the timeline `<main>` and show LivePanel content in its place
- Tab bar remains visible at top

## 4. LivePanel styling update

**File: `src/components/timeline/LivePanel.tsx`**

Update the placeholder content to be more polished:
- Radio icon with pulse animation (`animate-pulse`)
- Title: "LIVE" in bold
- Subtitle: "Live trip tracking, weather, and real-time updates"
- Warm background tint (`bg-primary/5`)
- Match app's warm colour palette

Desktop rendering: remove the Sheet wrapper entirely; just render a `div` with `border-r`, `overflow-y-auto`, and transition on width. Width is controlled by parent CSS classes passed via className or computed in the component based on a `bothOpen` prop.

## 5. CategorySidebar width adjustment

**File: `src/components/timeline/CategorySidebar.tsx`**

- Accept optional `compact` prop (boolean)
- When `compact` (both panels open): `w-[25vw]` instead of `w-[40vw]`
- When not compact (only planner open): `w-[30vw] max-w-[500px]`
- Mobile: unchanged (`w-[60vw] min-w-[280px]`)

## Files Changed

| File | Change |
|---|---|
| `src/components/timeline/TripNavBar.tsx` | Rewrite: 3 tabs (Live, Timeline, Planner), support toggle behavior |
| `src/pages/Timeline.tsx` | Add `liveOpen` state, `mobileView` state, 3-panel flex layout, update nav bar props |
| `src/components/timeline/LivePanel.tsx` | Enhanced placeholder styling, remove Sheet for mobile (use inline full-screen), desktop as flex panel |
| `src/components/timeline/CategorySidebar.tsx` | Add `compact` prop for narrower width when both panels open |

## Technical Notes

- Panel transitions use `transition-all duration-300` for smooth open/close
- Desktop: `flex` layout with `overflow-hidden` on container; each panel has `overflow-y-auto` for independent scrolling
- Mobile Live: rendered as a div that replaces the `<main>` content area (not a Sheet), keeping header + tab bar visible
- The FAB (`+` button) remains `fixed bottom-6 right-6 z-40` on all views
- UndoRedoButtons remain visible on all views
- Timeline tab click on desktop: sets `liveOpen = false` and `sidebarOpen = false`
- On mobile, tapping an already-active tab (e.g., tapping Timeline when already on timeline) is a no-op
