

# Fix Transport Gap Button + Flight Booking Upload

## Overview

Two changes:

1. **Transport gap button**: Skip the category picker and open directly into a transport-specific form with From/To auto-filled from adjacent entries and all route options auto-fetched
2. **Flight booking upload**: Add a document upload option to the flight form that parses booking confirmations (PDF/image) using AI to extract flight details

---

## 1. Transport Gap Button Fix

### Current problem
The "Transport" button in timeline gaps calls `onAddBetween(entry.end_time)` which opens the generic `EntryForm` at the category picker step. It does not pass adjacent entry context or skip to the transport layout.

### Solution

**CalendarDay.tsx** -- Add a new `onAddTransport` callback:

```
onAddTransport?: (fromEntryId: string, toEntryId: string, prefillTime: string) => void;
```

The transport gap button calls `onAddTransport(entry.id, nextEntry.id, entry.end_time)` instead of `onAddBetween(entry.end_time)`.

**Timeline.tsx** -- Add `handleAddTransport` handler + `transportContext` state:

- New state: `transportContext: { fromAddress: string; toAddress: string } | null`
- Handler extracts `location_name` (or `arrival_location` for flights) from the "from" entry's primary option, and `location_name` (or `departure_location`) from the "to" entry's primary option
- Sets `prefillCategory='transport'` so the category picker is skipped
- Sets `prefillStartTime` from the gap time
- Passes `transportContext` to EntryForm

**EntryForm.tsx** -- Accept and use `transportContext`:

- New prop: `transportContext?: { fromAddress: string; toAddress: string } | null`
- When provided alongside `prefillCategory='transport'`:
  - Auto-fill `transferFrom` and `transferTo`
  - Auto-fetch all 4 route modes (walk/transit/cycle/drive) on mount using the existing multi-mode `google-directions` edge function
  - Display results as an **inline route comparison list** (embedded version of TransportPicker UI) replacing the current manual "From / To / Mode grid / Calculate" layout
  - Auto-select the fastest mode
  - Auto-set `durationMin` and `endTime` from the selected route
  - Auto-generate name: e.g. "Walk to Restaurant Y"
  - User can tap a different mode to switch

Route comparison inline UI:

```
From: Museum X           To: Restaurant Y
 
Routes:
 [x] Walk      12m  0.8km
 [ ] Transit    8m  1.2km  
 [ ] Drive      4m  1.1km
 [ ] Cycle      6m  0.9km

-------- When --------
Start: 12:30    End: 12:42
Duration: 12 min (auto)
```

When `transportContext` is NOT provided (manual transport creation from category picker), the current manual From/To/Mode layout remains unchanged.

---

## 2. Flight Booking Document Upload

### Behavior
In the flight details form, add a "Upload booking" button that accepts PDF or image files. The document is sent to an AI edge function that extracts:
- Flight number (name)
- Departure/arrival airports (IATA codes)
- Departure/arrival terminals
- Departure/arrival times
- Date

Extracted data auto-fills the corresponding form fields. The user can review and correct before saving.

### Implementation

**New edge function: `supabase/functions/parse-flight-booking/index.ts`**

- Accepts a base64-encoded file (PDF or image) in the request body
- Uses Lovable AI (google/gemini-2.5-flash -- good at document understanding, cost-effective) to analyze the document
- Prompt instructs the model to extract structured flight data
- Returns JSON with extracted fields:
  ```json
  {
    "flights": [{
      "flight_number": "BA1234",
      "departure_airport": "LHR",
      "arrival_airport": "AMS", 
      "departure_terminal": "T5",
      "arrival_terminal": "T1",
      "departure_time": "10:30",
      "arrival_time": "13:00",
      "date": "2025-03-15"
    }]
  }
  ```

**EntryForm.tsx** -- Add upload button to flight section:

- After the "Name" field, add a small "Upload booking" button with a file input (accept: `.pdf, image/*`)
- On file select:
  - Read file as base64
  - Show loading spinner
  - Call `parse-flight-booking` edge function
  - Auto-fill: name (flight number), departure/arrival airports (trigger existing airport picker lookup by IATA code), terminals, times, date
  - Show toast: "Extracted flight details -- please review"
- If multiple flights found in the document, show a selector to pick which flight to use

---

## File Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/timeline/CalendarDay.tsx` | Edit | Add `onAddTransport` prop; transport gap button uses it with adjacent entries |
| `src/pages/Timeline.tsx` | Edit | Add `transportContext` state and `handleAddTransport`; pass context to EntryForm |
| `src/components/timeline/EntryForm.tsx` | Edit | Accept `transportContext` prop; auto-fill from/to; auto-fetch all route modes inline; add flight booking upload button |
| `supabase/functions/parse-flight-booking/index.ts` | Create | AI-powered flight booking document parser using Gemini |

No database changes needed.

---

## Technical Details

### Transport auto-fetch on mount (EntryForm.tsx)

```typescript
// New state
const [transportResults, setTransportResults] = useState<{mode: string; duration_min: number; distance_km: number}[]>([]);
const [transportLoading, setTransportLoading] = useState(false);

// Auto-fetch when transportContext provided
useEffect(() => {
  if (transportContext && categoryId === 'transport' && open) {
    setTransferFrom(transportContext.fromAddress);
    setTransferTo(transportContext.toAddress);
    fetchAllRoutes(transportContext.fromAddress, transportContext.toAddress);
  }
}, [transportContext, categoryId, open]);

const fetchAllRoutes = async (from: string, to: string) => {
  setTransportLoading(true);
  const { data, error } = await supabase.functions.invoke('google-directions', {
    body: { fromAddress: from, toAddress: to, modes: ['walk', 'transit', 'drive', 'bicycle'] },
  });
  if (!error && data?.results) {
    setTransportResults(data.results);
    // Auto-select fastest
    const fastest = data.results.reduce((a, b) => a.duration_min < b.duration_min ? a : b);
    setTransferMode(fastest.mode);
    setDurationMin(fastest.duration_min);
    // Update end time
    // Auto-generate name
    setName(`${modeLabel(fastest.mode)} to ${to.split(',')[0]}`);
  }
  setTransportLoading(false);
};
```

### Address extraction in Timeline.tsx

```typescript
const handleAddTransport = (fromEntryId: string, toEntryId: string, prefillTime: string) => {
  const allE = /* current entries array */;
  const fromEntry = allE.find(e => e.id === fromEntryId);
  const toEntry = allE.find(e => e.id === toEntryId);
  const fromOpt = fromEntry?.options[0];
  const toOpt = toEntry?.options[0];
  
  // Use location_name for regular entries, arrival_location for flights
  const fromAddr = fromOpt?.location_name || fromOpt?.arrival_location || '';
  const toAddr = toOpt?.location_name || toOpt?.departure_location || '';
  
  setTransportContext({ fromAddress: fromAddr, toAddress: toAddr });
  setPrefillStartTime(prefillTime);
  setPrefillCategory('transport');
  setEntryFormOpen(true);
};
```

### Flight booking parser edge function

Uses Lovable AI endpoint with Gemini 2.5 Flash for document understanding. The function:
1. Receives base64 file + MIME type
2. Sends to Gemini with a structured extraction prompt
3. Parses the JSON response
4. Returns extracted flight data

The prompt instructs the model to find flight numbers, IATA codes, terminals, times, and dates from booking confirmations, e-tickets, or itinerary screenshots.

