

# Brand Identity + New Trip CTA — Full Surface Treatment

## Overview
Introduce the "tr1p" brand across every user-facing screen with a reusable Brand component, add a prominent New Trip CTA on the dashboard, warm up all copy, and polish empty states and toast messages.

## Changes

### 1. New file: `src/components/Brand.tsx`
Create a reusable inline wordmark. "tr" and "p" in `text-foreground`, "1" in `text-primary` (orange). Accepts `size` prop (sm/md/lg/xl) mapping to text sizes.

### 2. `src/pages/Auth.tsx` (lines 61-68)
- Replace emoji-in-box + "Trip Planner" heading with `<Brand size="xl" />`
- Update subtitles: "Create your account to start planning" / "Welcome back -- sign in to continue"
- Remove unused `MapPin` import, add `Brand` import

### 3. `src/pages/Dashboard.tsx`

**Header (lines 141-158):**
- Replace `<h1>My Trips</h1>` with `<Brand size="sm" />`
- Keep display name, New Trip button, settings, logout as-is

**Body -- New Trip CTA (insert between line 188 and 190):**
- Add a dashed-border CTA card: "Plan a new trip" / "Start from scratch or add flights" with a Plus icon, navigates to `/trip/new`

**Empty state (lines 197-213):**
- Change "No trips yet" to "Where to first?"
- Change "Create your first trip to start planning" to "Create a trip and start building your itinerary"
- Change button text from "Create Trip" to "Plan My First Trip"

**Toast messages:**
- Line 119: "Link copied!" to "Link copied" with description "Send it to your travel crew!"
- Line 127: "Trip deleted" to "Trip removed"

### 4. `src/pages/UserSelect.tsx` (lines 150-158)
- Replace emoji box + "Trip Planner" fallback with `<Brand size="lg" />`
- Only render `<h1>{tripName}</h1>` when tripName exists
- Change subtitle: "Tap your name to jump in"
- Empty members text (line 169-170): "No members added yet -- the organiser will set this up."
- Add `Brand` import

### 5. `src/components/timeline/TimelineHeader.tsx` (line 44)
- Change fallback from `'Trip Planner'` to `'tr1p'` (plain string, no component needed in tight header)

### 6. `src/pages/NotFound.tsx`
- Full rewrite: branded 404 with compass emoji, "Looks like you're off the map", "Take me home" button, and small Brand component at bottom
- Remove `useLocation`/`useEffect`, add `useNavigate`, `motion`, `Brand`

### 7. `src/pages/Live.tsx` (lines 41-47)
- Change "Coming Soon" to "Track your trip in real-time -- coming soon"

### 8. `src/pages/TripWizard.tsx` (line 203)
- Change toast from `'Trip created!'` to `"Trip created -- let's plan!"`

### 9. Wizard step headers

**`src/components/wizard/NameStep.tsx`:**
- "What's your trip called?" to "Name your trip"
- "Give it a memorable name" to "Something you'll remember it by"

**`src/components/wizard/MembersStep.tsx` (lines 37-38):**
- "Who's coming?" to "Who's coming along?"
- "You'll be added automatically as organizer" to "You're the organiser -- add others if you'd like"

**`src/components/wizard/TimezoneStep.tsx`:**
- "Where are you starting from?" to "Where are you based?"
- "Select your home timezone" to "This sets the clock for your trip's timeline"

### 10. `index.html` meta tags
- Author: "Lovable" to "tr1p"
- Description: "For those who plan their adventures!" to "Plan your next adventure, together."
- Update og:description and twitter:description to match

### 11. `src/index.css` (line 6)
- Comment: "Trip Planner" to "tr1p"

## What does NOT change
- Timeline.tsx, ContinuousTimeline.tsx, EntrySheet.tsx
- Any Supabase queries, auth logic, data fetching
- CARD_COLORS, category definitions, trip type interface
- WizardStep.tsx layout/progress dots
- Toast messages in Timeline.tsx
- TripSettings.tsx, Settings.tsx, TripNavBar

## Files modified
| File | Change |
|------|--------|
| `src/components/Brand.tsx` | NEW -- reusable wordmark |
| `src/pages/Auth.tsx` | Wordmark hero, warmer subtitles |
| `src/pages/Dashboard.tsx` | Header wordmark, body CTA, empty state, toast copy |
| `src/pages/UserSelect.tsx` | Wordmark hero, warmer copy |
| `src/components/timeline/TimelineHeader.tsx` | Fallback text |
| `src/pages/NotFound.tsx` | Full rewrite |
| `src/pages/Live.tsx` | Coming soon copy |
| `src/pages/TripWizard.tsx` | Toast message |
| `src/components/wizard/NameStep.tsx` | Heading copy |
| `src/components/wizard/MembersStep.tsx` | Heading copy |
| `src/components/wizard/TimezoneStep.tsx` | Heading + subtitle copy |
| `index.html` | Meta author, description, og tags |
| `src/index.css` | Comment update |
