

# Follow-Up: Dark/Light Mode, Font Cleanup, and font-display Removal

## Overview
Three targeted changes that were missed in the previous design overhaul: wiring up dark/light mode toggling, removing Playfair Display in favor of DM Sans everywhere, and cleaning up `font-display` class usage across the codebase.

## Priority 1: Dark/Light Mode Toggle

### 1a. Wrap App in ThemeProvider (`src/App.tsx`)
- Import `ThemeProvider` from `next-themes` (already installed as a dependency)
- Wrap the entire app content inside `<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>`
- This activates the existing `.dark` CSS variables and all `dark:` Tailwind variants throughout the codebase

### 1b. Add Theme Toggle to Timeline Header (`src/components/timeline/TimelineHeader.tsx`)
- Import `useTheme` from `next-themes`, `Moon` and `Sun` from `lucide-react`
- Add a ghost icon button in the right-side button group (before the User/Account button)
- Clicking toggles between `dark` and `light` using `setTheme()`
- Show `Sun` icon when in dark mode, `Moon` icon when in light mode

## Priority 2: Font Consistency

### 2a. Remove Playfair Display (`src/index.css`)
- Update the Google Fonts import to remove `Playfair+Display` and add weight `800` to DM Sans
- Remove the `h1, h2, h3 { font-family: 'Playfair Display', serif; }` rule (lines 109-111)
- Remove the `.font-display { font-family: 'Playfair Display', serif; }` utility (lines 114-118)

### 2b. Remove `font-display` class from components (8 files)
Remove the `font-display` class from all occurrences:

| File | Line(s) | Element |
|------|---------|---------|
| `src/components/timeline/LivePanel.tsx` | 21 | h3 heading |
| `src/components/timeline/TimelineDay.tsx` | 62 | day label span |
| `src/pages/Dashboard.tsx` | 206 | trip name h3 |
| `src/components/timeline/FlightGroupCard.tsx` | 136 | flight name h3 |
| `src/components/timeline/CategorySidebar.tsx` | 194 | planner header div |
| `src/components/timeline/ConflictResolver.tsx` | 29 | dialog title |
| `src/components/timeline/EntrySheet.tsx` | 1253, 1835 | dialog titles |
| `src/pages/Live.tsx` | 45 | heading h2 |

In each case, simply remove the `font-display` class string, keeping all other classes intact.

## What does NOT change
- EntryCard.tsx -- already has the correct diagonal fade design from previous implementation
- TransportConnector.tsx, SidebarEntryCard.tsx -- separate future passes
- Any drag/interaction logic
- Database schema
- CSS variables for light/dark themes (already defined correctly)

## Files modified
| File | Change |
|------|--------|
| `src/App.tsx` | Wrap in ThemeProvider |
| `src/components/timeline/TimelineHeader.tsx` | Add Sun/Moon toggle button |
| `src/index.css` | Remove Playfair Display, add DM Sans 800 weight |
| `src/components/timeline/LivePanel.tsx` | Remove font-display class |
| `src/components/timeline/TimelineDay.tsx` | Remove font-display class |
| `src/pages/Dashboard.tsx` | Remove font-display class |
| `src/components/timeline/FlightGroupCard.tsx` | Remove font-display class |
| `src/components/timeline/CategorySidebar.tsx` | Remove font-display class |
| `src/components/timeline/ConflictResolver.tsx` | Remove font-display class |
| `src/components/timeline/EntrySheet.tsx` | Remove font-display class (2 locations) |
| `src/pages/Live.tsx` | Remove font-display class |

