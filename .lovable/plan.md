

# Flight Overview Parity + Instant Save Feedback

## What's Changing

The flight view dialog will be upgraded to match the creation form's completeness, and edits will feel instant instead of having a noticeable delay.

## 1. Add Missing Editable Fields to Flight View

Currently the flight view only shows: name, departure/arrival airports, terminals (only if already set), departure/arrival times, and lock status.

**Missing fields to add (matching creation form):**

- **Departure Terminal** -- always show, even when empty (currently hidden if null). Use InlineField with placeholder "Add terminal"
- **Arrival Terminal** -- same treatment
- **Check-in Duration** (hours before departure) -- editable InlineField that saves to `option.airport_checkin_hours` and cascades to the linked checkin entry times
- **Checkout Duration** (minutes after arrival) -- editable InlineField that saves to `option.airport_checkout_min` and cascades to the linked checkout entry times
- **Flight Date** -- show the date in the departure timezone, editable

These will be placed in the flight view section (lines 930-1000) as a new "Airport Processing" sub-section below the route display, styled similarly to the creation form's bordered panel.

## 2. Checkin/Checkout Duration Editing with Cascade

When checkin hours or checkout minutes are changed:

- Save the new value to `entry_options` (`airport_checkin_hours` / `airport_checkout_min`)
- Query linked entries by `linked_flight_id`
- Recalculate linked checkin: `start_time = departure - newHours`, `end_time = departure`
- Recalculate linked checkout: `start_time = arrival`, `end_time = arrival + newMinutes`
- Call `onSaved()` to refresh

## 3. Instant Save Feedback (Optimistic UI)

The delay happens because `InlineField` saves to the DB, then calls `onSaved()` which triggers `fetchData()` (a full re-fetch), and only then does the parent re-render with new props. During the refetch, the old `value` is still displayed.

**Fix**: Update `InlineField` to optimistically show the draft value after save completes, rather than reverting to the old prop value. Specifically:

- After `onSave(draft)` succeeds, keep `draft` as the displayed value (don't revert to `value` prop)
- Add a `useEffect` that syncs the display when the parent prop actually updates
- This eliminates the visual "snap back" between save and refetch

## Technical Details

### File: `src/components/timeline/EntrySheet.tsx`

**InlineField optimistic update** (lines 45-89):
- Add `displayValue` state initialized from `value` prop
- After successful save, set `displayValue = draft` immediately
- `useEffect` to sync `displayValue` when `value` prop changes

**Flight view section** (after line 999, before the closing `</div>` of the flight card):

```
{/* Airport Processing - editable durations */}
{isEditor && (
  <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
    <p className="text-xs font-medium text-muted-foreground">Airport Processing</p>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Check-in (hours before)</Label>
        <InlineField
          value={String(option.airport_checkin_hours ?? defaultCheckinHours)}
          canEdit={true}
          inputType="number"
          onSave={async (v) => {
            const hrs = Math.max(0, Number(v) || 0);
            await handleInlineSaveOption('airport_checkin_hours', String(hrs));
            // Cascade to linked checkin entry
            await cascadeCheckinDuration(hrs);
          }}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Checkout (minutes after)</Label>
        <InlineField
          value={String(option.airport_checkout_min ?? defaultCheckoutMin)}
          canEdit={true}
          inputType="number"
          onSave={async (v) => {
            const mins = Math.max(0, Number(v) || 0);
            await handleInlineSaveOption('airport_checkout_min', String(mins));
            // Cascade to linked checkout entry
            await cascadeCheckoutDuration(mins);
          }}
        />
      </div>
    </div>
  </div>
)}
```

**Terminal fields** -- change from conditional rendering (`{option.departure_terminal && ...}`) to always render with a placeholder when empty.

**New cascade helpers** added near `handleFlightTimeSave`:

- `cascadeCheckinDuration(newHours)` -- queries linked checkin by `linked_flight_id`, sets `end_time = entry.start_time`, `start_time = start_time - newHours * 3600000`
- `cascadeCheckoutDuration(newMinutes)` -- queries linked checkout, sets `start_time = entry.end_time`, `end_time = end_time + newMinutes * 60000`

### Summary of Changes

| Area | Change |
|------|--------|
| `InlineField` component | Add optimistic display so edits appear instant |
| Flight view: terminals | Always show departure/arrival terminal fields (with "Add terminal" placeholder when empty) |
| Flight view: processing | Add "Airport Processing" section with editable check-in hours and checkout minutes |
| Flight view: date | Show flight date in departure timezone |
| Cascade helpers | New `cascadeCheckinDuration` and `cascadeCheckoutDuration` functions |

