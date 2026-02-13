
# Parser Auto-Enrichment from Google Places + Checkout Block Fix

## Overview

Three changes: (1) after parsing a hotel booking, auto-search Google Places and either auto-select a strong match or show candidates, (2) remove the separate checkout block and extend the final overnight to checkout time, (3) ensure all enrichment fields are written to the hotels table.

---

## Fix 1: Auto-enrich parsed hotel with Google Places

### After parsing succeeds (line ~156-164 in `handleUpload`)

Instead of jumping straight to Step 1, insert a new async flow:

1. Call `supabase.functions.invoke('google-places', { body: { action: 'autocomplete', query: hotel.hotel_name } })` to get predictions.
2. If predictions exist, fetch details for the top result: `supabase.functions.invoke('google-places', { body: { action: 'details', placeId: topPrediction.place_id } })`.
3. **Confidence check**: Compare parsed `hotel_name` (lowercased, trimmed) against top result name. If one contains the other or they share 2+ significant words (split on spaces, filter out words < 3 chars), treat as strong match.

### New state variables

```tsx
const [placeCandidates, setPlaceCandidates] = useState<Array<{ placeId: string; name: string; address: string; }>>([]);
const [autoMatchedPlace, setAutoMatchedPlace] = useState<PlaceDetails | null>(null);
const [enrichmentStep, setEnrichmentStep] = useState<'idle' | 'searching' | 'matched' | 'candidates' | 'manual'>('idle');
```

### Step 1 UI changes

Step 1 now has conditional rendering based on `enrichmentStep`:

- **`searching`**: Show spinner "Finding your hotel on Google..."
- **`matched`** (strong match found): Show a confirmation card with photo, name, address, rating. Two buttons: "Confirm" (applies enrichment, goes to Step 2) and "This isn't right" (switches to `candidates` or `manual`).
- **`candidates`** (multiple matches): Show top 3-5 results as tappable cards (photo thumb, name, address, rating). Tapping one fetches full details and applies enrichment. Bottom option: "Search manually" switches to `manual`.
- **`manual`** / **`idle`**: Show the existing PlacesAutocomplete input (pre-filled with parsed hotel name if from parser).

### Enrichment merge logic

When a Google Places result is selected (auto or manual), apply all Place data (lat, lng, photos, phone, website, rating, userRatingCount, googlePlaceId, googleMapsUri, address) but keep the parser's dates/times.

---

## Fix 2: Remove separate checkout block, extend final overnight

### In `handleFinish` (lines 322-339)

Change the overnight block loop and remove the checkout block:

```tsx
for (let n = 0; n < nights; n++) {
  const nightDate = format(addDays(parseISO(ciDate), n), 'yyyy-MM-dd');
  const nextDate = format(addDays(parseISO(ciDate), n + 1), 'yyyy-MM-dd');
  const nightTz = tzFor(nightDate);
  const nextTz = tzFor(nextDate);
  const oStart = localToUTC(nightDate, hotel.eveningReturn || '22:00', nightTz);

  const isLastNight = n === nights - 1;
  // Last night extends to checkout time instead of morning_leave
  const endTime = isLastNight ? (hotel.checkoutTime || '11:00') : (hotel.morningLeave || '08:00');
  const oEnd = localToUTC(nextDate, endTime, nextTz);

  const optionName = isLastNight ? `Check out · ${hotel.name}` : hotel.name;
  const linkedType = isLastNight ? 'checkout' : null;

  // createBlock gets a new optional linkedType param
  await createBlock(oStart, oEnd, optionName, dayIndex(nightDate), linkedType);
}

// DELETE the checkout block section (lines 332-339)
```

Update `createBlock` to accept optional `linkedType`:

```tsx
const createBlock = async (
  startIso: string,
  endIso: string,
  optionName: string,
  scheduledDay: number | null,
  linkedType?: string | null,
) => {
  const { data: entry } = await supabase.from('entries').insert({
    trip_id: tripId,
    start_time: startIso,
    end_time: endIso,
    is_scheduled: true,
    scheduled_day: scheduledDay,
    linked_type: linkedType || null,  // Add this field
  } as any).select('id').single();
  // ... rest unchanged
};
```

### Result for 3-night stay (Mon check-in 15:00, Thu checkout 11:00):
- Check-in: Mon 15:00-16:00 -- "Check in . Hotel Pulitzer"
- Night 1: Mon 22:00-Tue 08:00 -- "Hotel Pulitzer"
- Night 2: Tue 22:00-Wed 08:00 -- "Hotel Pulitzer"
- Night 3: Wed 22:00-Thu 11:00 -- "Check out . Hotel Pulitzer", linked_type: 'checkout'

---

## Fix 3: Ensure all enrichment data written to hotels table

The current `handleFinish` already writes most fields (lines 215-235). Verify and ensure these are all populated:
- `phone` -- already written
- `rating` -- already written
- `user_rating_count` -- already written
- `google_place_id` -- already written
- `google_maps_uri` -- already written

This is already correct in the current code. No changes needed here.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/HotelWizard.tsx` | Add auto-enrichment flow after parsing, new enrichment UI in Step 1, remove checkout block, extend final overnight |

## What Does NOT Change

- `parse-hotel-booking` edge function
- `google-places` edge function
- EntrySheet, EntryCard, ContinuousTimeline
- Transport, flight systems
- Check-in block (stays as separate 1hr block)
