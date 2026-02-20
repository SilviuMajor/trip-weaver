
# L2 — Activities / Explore Step in Trip Creation Wizard

## Overview
Add an Activities step (step 3) between Hotels and Members in the trip creation wizard. Users browse categories, search places via the google-places edge function, build a wishlist, and these become unscheduled planner entries on trip creation.

## New Step Order
```
Step 0: Name + Destination
Step 1: Dates + Flights
Step 2: Hotels
Step 3: Activities (NEW)
Step 4: Members
```

## Changes

### 1. New file: `src/components/wizard/ActivitiesStep.tsx`

A self-contained explore experience for the wizard with:

- **Props:** `activities: ActivityDraft[]`, `onChange`, `destination: string`, `originLat?: number | null`, `originLng?: number | null`
- **`ActivityDraft` type:** `{ place: ExploreResult; categoryId: string }` (exported)
- **Origin resolution:** Uses provided lat/lng if available, otherwise geocodes `destination` via google-places textSearch
- **Category grid:** Shows non-transport categories (breakfast, lunch, dinner, drinks, nightlife, coffee, museum, activity, sightseeing, shopping, park) as tappable cards
- **Category tap:** Performs nearbySearch with category's place types around origin
- **Text search:** Debounced 500ms, calls textSearch with location bias and optional category type filter
- **Results:** Rendered as ExploreCard components in a 2-column grid
- **Wishlist chips:** Added activities shown at top as removable badge chips with category emoji
- **Add/remove:** Tap "+" on ExploreCard adds to wishlist (deduped by placeId), X on chip removes
- **Back to categories:** Arrow button when browsing a category to return to the grid

Key imports: ExploreCard, ExploreResult from ExploreView, categories/placeTypeMapping helpers, supabase client.

### 2. Modify: `src/pages/TripWizard.tsx`

**Imports:**
- Add `ActivitiesStep` and `ActivityDraft` type
- Add `AIRPORTS` default import from `@/lib/airports`
- Add `findCategory` from `@/lib/categories`
- Add `useMemo` from React

**STEPS array (line 21):**
- Change from `['Name', 'Dates', 'Hotels', 'Members']` to `['Name', 'Dates', 'Hotels', 'Activities', 'Members']`

**State (after line 39):**
- Add `const [activityDrafts, setActivityDrafts] = useState<ActivityDraft[]>([]);`

**New `activityOrigin` memo:**
- Derives lat/lng from first hotel with coordinates, or arrival airport from outbound flight, or null (let ActivitiesStep geocode)

**New `createPlannerEntries` function:**
- Creates unscheduled entries (`is_scheduled: false`) with a reference date of 2099-01-01
- For each activity: inserts entry, entry_option with all enrichment fields, then background-fetches photos via google-places details action (with photo URL normalisation)

**handleCreate (after hotel block):**
- Add `if (activityDrafts.length > 0) await createPlannerEntries(trip.id, activityDrafts, timezone);`

**Toast update:**
- Add activities count to the success description

**Step rendering:**
- Step 2: HotelStep (unchanged)
- Step 3: ActivitiesStep with activityDrafts, destination, and derived origin coords
- Step 4: MembersStep (renumbered from 3)

**Skip logic:** Already covers step 3 (`step >= 2 && !isLastStep`), no change needed.

## What does NOT change
- ExploreView.tsx, ExploreCard.tsx -- used as-is
- NameStep, DateStep, HotelStep, MembersStep, WizardStep
- Timeline.tsx, EntrySheet.tsx, ContinuousTimeline.tsx
- google-places edge function
- Database schema
- No files deleted

## Files modified
| File | Change |
|------|--------|
| `src/components/wizard/ActivitiesStep.tsx` | NEW -- Category grid + search + results + wishlist |
| `src/pages/TripWizard.tsx` | Add Activities step (step 3), activityDrafts state, createPlannerEntries, activityOrigin memo, update STEPS/rendering/toast |
