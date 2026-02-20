

# Phase 1b — Hotel Step in Trip Creation Wizard

## Overview
Restructure the trip wizard from 5 steps to 4 (Name, Dates, Hotels, Members) by removing Timezone and Categories steps. Add a new inline HotelStep that replicates the full HotelWizard experience. Hotel drafts are collected in state and saved to the database in `handleCreate`.

## Changes

### 1. Export `HotelDraft` from `src/components/timeline/HotelWizard.tsx` (line 15)
Change `interface HotelDraft` to `export interface HotelDraft`. No other changes to this file.

### 2. New file: `src/components/wizard/HotelStep.tsx`
A self-contained inline hotel sub-wizard with 5 internal sub-steps (0-4), replicating the HotelWizard UI but without Dialog/Supabase saves:

- **Sub-step 0**: Entry method -- Upload Booking Confirmation / Enter Manually buttons (plus parsing state)
- **Sub-step 1**: Hotel details with auto-enrichment (searching/matched/candidates/manual states), using PlacesAutocomplete
- **Sub-step 2**: Dates and times (check-in/checkout date+time, night count)
- **Sub-step 3**: Daily defaults (evening return, morning leave)
- **Sub-step 4**: Review card + "Add Another" / "Done" buttons

Props: `hotels: HotelDraft[]`, `onChange: (hotels: HotelDraft[]) => void`, `defaultCheckInDate: string`, `defaultCheckoutDate: string`

Key differences from HotelWizard:
- No Dialog wrapper -- renders inline
- No Supabase writes -- collects drafts via `onChange` callback
- "Done" at sub-step 4 finalises the current draft into the array, resets to sub-step 0
- Shows previously-added hotels as summary cards above the current sub-step
- Header: "Where are you staying?" / "Add your hotel -- or skip this for now"
- Sub-step progress dots (only visible after sub-step 0)

Copies core logic from HotelWizard: `autoEnrichFromParsedName`, `selectCandidate`, `handleUpload`, `applyPlaceDetails`, `resetFields`, `buildDraft`, `renderStep1`, file upload handling, enrichment state machine, and all step UIs (steps 0-4).

### 3. Modify: `src/pages/TripWizard.tsx`

**Imports (lines 9-15):**
- Remove `TimezoneStep`, `CategoryStep`, `CategoryPreset` imports
- Add `HotelStep` import and `HotelDraft` type import from HotelWizard
- Add `differenceInCalendarDays` to date-fns import

**STEPS array (line 22):**
- Change from `['Name', 'Dates', 'Timezone', 'Categories', 'Members']` to `['Name', 'Dates', 'Hotels', 'Members']`

**State (lines 39-41):**
- Remove `timezone` (keep as local variable defaulting to `'Europe/London'`, updated by flight effect), `categories` state
- Add `hotelDrafts: HotelDraft[]` state
- Keep `timezone` state but remove its wizard step -- it's still set by the flight auto-detect effect and used in `handleCreate`

**handleCreate (lines 147-210):**
- Change `category_presets` to `null` in insert data
- After flight creation block, add hotel creation loop calling new `createHotelEntries` function
- Update success toast to include hotel count when applicable

**New function `createHotelEntries`** (before handleCreate):
Replicates HotelWizard's `handleFinish` block creation logic:
- Insert into `hotels` table
- Create check-in block (1hr)
- Create overnight blocks (last night extends to checkout, tagged `linked_type: 'checkout'`)
- Each block gets entry + entry_option + option_images
- Uses `fallbackTz` (home timezone) since no flights exist on timeline yet during creation

**Step rendering (lines 236-263):**
- Step 0: NameStep (unchanged)
- Step 1: DateStep (unchanged)
- Step 2: `<HotelStep hotels={hotelDrafts} onChange={setHotelDrafts} defaultCheckInDate={startDate} defaultCheckoutDate={endDate} />`
- Step 3: MembersStep (unchanged, renumbered from step 4)

**Skip logic (line 233):**
- Change `canSkip={step > 1 && !isLastStep}` to `canSkip={step >= 2 && !isLastStep}` (steps 2+ are skippable)

## What does NOT change
- WizardStep.tsx -- adapts automatically to new STEPS length
- NameStep.tsx, DateStep.tsx, MembersStep.tsx -- unchanged
- TimezoneStep.tsx, CategoryStep.tsx -- files kept, just not imported
- HotelWizard.tsx -- only exports HotelDraft, rest unchanged
- Timeline.tsx, EntrySheet.tsx, ContinuousTimeline.tsx -- untouched
- No database schema changes

## Files modified
| File | Change |
|------|--------|
| `src/components/wizard/HotelStep.tsx` | NEW -- inline hotel sub-wizard |
| `src/components/timeline/HotelWizard.tsx` | Export `HotelDraft` interface (line 15) |
| `src/pages/TripWizard.tsx` | Remove Timezone/Category steps, add Hotel step, add `createHotelEntries`, update STEPS/state/rendering |

