
# Wizard Restructure -- FlightStep + Hotel Refinements + Skip Logic

## Overview
Restructure the trip creation wizard from 5 steps to 6: Name, Dates, Flights, Hotels, Activities, Members. Flights move to their own dedicated step with upload-first flow. Hotel sub-wizard drops the redundant review step and adds an explicit "another hotel?" fork. Skip button hides when the current step has data.

## Changes

### 1. New file: `src/components/wizard/FlightStep.tsx`

A dedicated flight wizard step with upload-first flow and internal sub-steps:

- **Sub-step 0:** Entry method -- "Upload Booking Confirmation" / "Enter Manually" buttons (same visual pattern as HotelStep). When multiple flights parsed from one document, shows selection list to add one by one.
- **Sub-step 1:** Flight details form -- flight number, AirportPicker for from/to, time inputs, date input. Pre-filled from upload or manual. "Confirm" button at bottom.
- **Sub-step 2:** "Do you have another flight?" fork -- "Add Another" (resets to sub-step 0, pre-fills reversed airports for return) or "No, continue" (stays put, main wizard Next advances).

Features:
- `FlightDraft` interface with `flightNumber` and `date` fields (new, replaces old DateStep FlightDraft)
- Summary cards above current sub-step showing previously added flights (with remove button)
- Upload uses `parse-flight-booking` edge function (same as DateStep did)
- `applyParsedFlight` resolves IATA codes to full airport names/timezones via AIRPORTS array
- Second flight pre-fills with reversed airports and trip end date

### 2. Modify: `src/components/wizard/DateStep.tsx`

Strip all flight-related code to become a pure date-only step:
- Remove `FlightDraft` interface and export
- Remove flight props from `DateStepProps` (outboundFlight, returnFlight, etc.)
- Remove all flight state, handlers, and JSX (the entire Collapsible flights section)
- Remove unused imports (Collapsible, ChevronDown, Plane, cn, AirportPicker, Airport)
- Result: a clean ~60-line component with just date pickers and "I don't know when" toggle

### 3. Modify: `src/components/wizard/HotelStep.tsx`

Two refinements:

**a) Remove sub-step 4 (redundant review):**
- When sub-step 3 "Next" is clicked: finalise draft into hotels array, reset fields, advance to new sub-step 4 (the fork)
- Remove old sub-step 4 review card JSX (lines 547-578)

**b) Replace with "another hotel?" fork:**
- Sub-step 4 becomes: "Hotel added" confirmation with two buttons -- "Add Another Hotel" (resets to sub-step 0) and "No, continue" (stays put for main wizard Next)
- Update progress dots from 5 to 4 (sub-steps 0-3 for entry/details/dates/defaults, sub-step 4 is the fork without a dot)
- Update sub-step navigation to trigger finalise at step 3 instead of just incrementing
- Show hotel summary cards on sub-step 4 too (change condition from `subStep < 4` to `subStep <= 4`)

### 4. Modify: `src/pages/TripWizard.tsx`

**STEPS array:** `['Name', 'Dates', 'Flights', 'Hotels', 'Activities', 'Members']`

**Imports:**
- Remove `FlightDraft` import from DateStep
- Add `FlightStep` and its `FlightDraft` type
- DateStep import becomes plain (no type export)

**State:**
- Replace `outboundFlight`/`returnFlight` with `const [flightDrafts, setFlightDrafts] = useState<FlightDraft[]>([])`

**Timezone auto-set:**
- Use `flightDrafts[0]?.departureTz` instead of `outboundFlight?.departureTz`

**Step rendering (6 steps):**
- Step 0: NameStep (unchanged)
- Step 1: DateStep (without flight props)
- Step 2: FlightStep (new)
- Step 3: HotelStep (was step 2)
- Step 4: ActivitiesStep (was step 3)
- Step 5: MembersStep (was step 4)

**Flight creation in handleCreate:**
- Replace old `if (outboundFlight)` / `if (returnFlight)` blocks with loop over `flightDrafts`
- Each flight uses its own `.date` field (or falls back to startDate)
- Flight name uses `flightNumber` or generated from airport codes

**activityOrigin memo:**
- Use `flightDrafts[0]?.arrivalLocation` instead of `outboundFlight?.arrivalLocation`

**Skip logic:**
- `canSkip={step >= 2 && !isLastStep && !(step === 2 && flightDrafts.length > 0) && !(step === 3 && hotelDrafts.length > 0) && !(step === 4 && activityDrafts.length > 0)}`

**Toast:**
- Update flight count: `flightDrafts.length` flights instead of generic "flights"

### 5. `src/lib/timezoneUtils.ts` -- No change needed

Line 30 already has the Z suffix (`new Date(\`${dateStr}T${timeStr}:00Z\`)`). No fix required.

## What does NOT change
- WizardStep.tsx, NameStep.tsx, MembersStep.tsx, ActivitiesStep.tsx
- HotelWizard.tsx (timeline version)
- Timeline.tsx, ContinuousTimeline.tsx, EntrySheet.tsx
- Edge functions, database schema
- createFlightEntry function body (only call site changes)
- createHotelEntries, createPlannerEntries functions

## Files modified
| File | Change |
|------|--------|
| `src/components/wizard/FlightStep.tsx` | NEW -- Upload-first flight wizard step with sub-steps |
| `src/components/wizard/DateStep.tsx` | Remove all flight code, simplify to pure dates |
| `src/components/wizard/HotelStep.tsx` | Remove review step 4, add "another hotel?" fork |
| `src/pages/TripWizard.tsx` | 6-step wizard, FlightDraft array, conditional skip, updated rendering/creation/toast |
