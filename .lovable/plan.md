

# Header Restructure + Navigation Bar + Rename + Live Page

## Overview

Restructure the trip page header into a clean top row (trip info + settings/exit), add a contextual 3-button navigation bar below it, rename "Trip Events" to "Planner" everywhere, and create a Live page placeholder.

## Part 1 — Header Restructure

**File: `src/components/timeline/TimelineHeader.tsx`**

Simplify the header to two groups:

- **Left side**: Trip icon/image + trip name + welcome message (keep existing)
- **Right side**: Settings cog (organizer only) + exit/back button (LogOut). Remove all other buttons from the header (LIVE toggle, lock, auto-transport, weather, +, ideas lightbulb). These organizer tools will move into a toolbar or be accessible elsewhere -- the lock, weather, and auto-transport buttons move into a collapsible "tools" row or dropdown on the header (or kept as a secondary row visible only to organizers).

Actually, to keep functionality accessible without losing it:
- Keep the organizer tools (lock, auto-transport, weather) in a second subtle row below the title, visible only to organizers
- Remove: LIVE toggle button, + button, Ideas/Lightbulb button from the header (these move to the nav bar)
- Keep: Settings cog + LogOut on the right of the top row

**Props changes**: Remove `onToggleLive`, `liveOpen` from header props. Keep `onAddEntry` but don't render it in header (it's used by the nav bar's + button). Keep `onToggleIdeas` but don't render in header.

## Part 2 — Contextual Navigation Bar

**New file: `src/components/timeline/TripNavBar.tsx`**

A sticky navigation bar rendered below the header. Props:
- `currentPage`: `'timeline' | 'planner' | 'live'`
- `tripId`: string
- `onAddEntry`: callback for the + button
- `ideasCount?`: number (badge on Planner button)

Three buttons based on `currentPage`:

| Current Page | Left | Centre | Right |
|---|---|---|---|
| Timeline | Live (Radio icon) | + (large, primary) | Planner (ClipboardList icon) |
| Planner | Live (Radio icon) | + (large, primary) | Timeline (Calendar icon) |
| Live | Timeline (Calendar icon) | + (large, primary) | Planner (ClipboardList icon) |

Navigation uses `react-router-dom`'s `useNavigate`:
- Timeline: `/trip/{tripId}/timeline`
- Planner: `/trip/{tripId}/planner`
- Live: `/trip/{tripId}/live`

Styling: sticky below header (`sticky top-[header-height]`), clean border-bottom, warm background matching app palette. The + button is larger and uses primary color.

**File: `src/pages/Timeline.tsx`**
- Import and render `TripNavBar` after `TimelineHeader`, passing `currentPage="timeline"`
- Remove the mobile FAB button for CategorySidebar (the Planner nav button replaces it)
- The Planner nav button navigates to `/trip/{tripId}/planner` instead of toggling the sidebar

## Part 3 — Rename "Trip Events" to "Planner"

**File: `src/components/timeline/CategorySidebar.tsx`**
- Line 160: Change "Trip Events" to "Planner"
- Line 272: Change SheetTitle "Trip Events" to "Planner"
- Change the icon from `LayoutList` to `ClipboardList`

## Part 4 — New Routes and Pages

**New file: `src/pages/Live.tsx`**
- A page that fetches the trip, shows the same header + nav bar layout
- Centre content: Radio icon + "Live View -- Coming Soon" text
- Uses `TripNavBar` with `currentPage="live"`

**New file: `src/pages/Planner.tsx`**
- A full-page version of the CategorySidebar content (not a sheet/panel)
- Shows header + nav bar + the category-grouped entry list
- Uses `TripNavBar` with `currentPage="planner"`
- Reuses the existing `CategorySidebar` component's panel content logic, but rendered as a full page instead of a sidebar/sheet

**File: `src/App.tsx`**
- Add route: `/trip/:tripId/planner` -> `<Planner />`
- Add route: `/trip/:tripId/live` -> `<Live />`

## Files Changed

| File | Change |
|---|---|
| `src/components/timeline/TimelineHeader.tsx` | Simplify: keep trip info left, settings+exit right. Move organizer tools to subtle second row. Remove nav buttons. |
| `src/components/timeline/TripNavBar.tsx` | **New** -- Contextual 3-button nav bar |
| `src/pages/Timeline.tsx` | Add TripNavBar, remove mobile FAB for sidebar |
| `src/pages/Live.tsx` | **New** -- Live placeholder page |
| `src/pages/Planner.tsx` | **New** -- Full-page planner (was CategorySidebar) |
| `src/App.tsx` | Add /planner and /live routes |
| `src/components/timeline/CategorySidebar.tsx` | Rename "Trip Events" to "Planner", update icon |

## Technical Details

- The nav bar uses `z-20` (below header's `z-30`) and `sticky` positioning
- The + button in the centre is `h-12 w-12 rounded-full bg-primary` for prominence
- Navigation between pages preserves trip context via URL params
- The Planner page needs access to trip data and entries -- it will fetch them similarly to Timeline.tsx or receive them via shared state/context (simplest: fetch independently since each page is a separate route)

