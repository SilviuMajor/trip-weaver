

# Navigation and Account Rework

## What changes

### 1. New `src/components/UserAvatar.tsx`
Shared initials-based coloured circle component used across all pages.

### 2. Dashboard header (`src/pages/Dashboard.tsx`)
- Left: UserAvatar (tappable, goes to Account Settings)
- Centre: Brand logo
- Right: empty spacer for balance
- Remove "New Trip" button, Settings gear, and LogOut from header (CTA card below handles new trips)

### 3. Timeline header (`src/components/timeline/TimelineHeader.tsx`)
- Left: Home icon button + trip name + greeting
- Right: Refresh button + overflow menu (Trip Settings, Account, Theme toggle, Sign Out)
- Replaces the current 5 icon buttons with 2 (refresh + overflow)

### 4. Account Settings (`src/pages/Settings.tsx`)
Full rebuild:
- Large UserAvatar at top with name + email
- Display name editor with save
- Preferences section: theme toggle (dark/light switch), pinch-to-zoom switch
- Sign Out button at bottom (destructive style)
- Back arrow uses `navigate(-1)` instead of hardcoded route

### 5. Global Planner (`src/pages/GlobalPlanner.tsx`)
- Add UserAvatar to header right side (visible only on top-level city list view)
- Tapping avatar goes to Account Settings

### 6. Global Explore (`src/pages/GlobalExplore.tsx`)
- Add UserAvatar to header right side (location picker state)
- Tapping avatar goes to Account Settings

## Files changed

| File | Change |
|------|--------|
| `src/components/UserAvatar.tsx` | NEW -- initials-based coloured avatar |
| `src/pages/Dashboard.tsx` | Header: avatar left, Brand centred, remove buttons |
| `src/components/timeline/TimelineHeader.tsx` | Full rewrite: Home + overflow menu |
| `src/pages/Settings.tsx` | Full rebuild: avatar, theme, zoom, sign out |
| `src/pages/GlobalPlanner.tsx` | Add avatar to header |
| `src/pages/GlobalExplore.tsx` | Add avatar to header |

## Technical details

- `UserAvatar` generates a deterministic hue from the user's name string for consistent colouring
- Timeline header keeps `useTripMember` hook (current auth pattern) and `useAdminAuth` for sign out
- DropdownMenu from radix used for the overflow menu in timeline header
- `useTheme` from next-themes used in both Settings and timeline overflow menu
- No database or routing changes needed

