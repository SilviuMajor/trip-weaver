

# Fix Magnet Snap: All Transport Modes + Icon Positioning

## Issue 1: Only walking mode is generated

Currently `handleMagnetSnap` in Timeline.tsx (line 534) calls `google-directions` with `mode: 'walk'` (single-mode). This only returns one result. The edge function already supports multi-mode via `modes: ['walk', 'transit', 'drive', 'bicycle']`, which returns all modes at once.

Additionally, the trip needs a `default_transport_mode` setting so the magnet knows which mode to use for the transport block duration/name.

### Changes

**Database**: Add `default_transport_mode` column to `trips` table (text, default `'transit'`).

**File: `src/pages/TripSettings.tsx`**: Add a "Default transport mode" dropdown (Walk, Transit, Drive, Cycle) that reads/writes `default_transport_mode` on the trip.

**File: `src/pages/Timeline.tsx`** (lines 531-566): Change the `google-directions` call from single-mode to multi-mode:

```
Before:
  body: { fromAddress, toAddress, mode: 'walk', departureTime: ... }

After:
  body: { fromAddress, toAddress, modes: ['walk', 'transit', 'drive', 'bicycle'], departureTime: ... }
```

Then use the trip's `default_transport_mode` (or fall back to `'transit'`) to pick the primary mode for the transport block's duration and name. Store all mode results in `transport_modes` on the entry option so the connector pill shows all modes immediately (no need to open the overview to generate them).

The relevant code block becomes:

```text
1. Call google-directions with modes: ['walk', 'transit', 'drive', 'bicycle']
2. Find the default mode result from dirData.results
3. Use its duration for the transport block size
4. Store all results in transport_modes JSON on the entry_option
5. Name the entry based on default mode (e.g. "Transit to X" or "Walk to X")
```

## Issue 2: Magnet icon positioning and rotation

**File: `src/components/timeline/EntryCard.tsx`** (lines 158-159): 

Currently the magnet button uses `absolute bottom-1.5 right-1.5` which places it slightly inset from the corner. Change to `absolute -bottom-1 -right-1` (same technique as the lock icon -- overlapping the card edge to sit ON the corner).

Also change the `Magnet` icon to include `style={{ transform: 'rotate(0deg)' }}` to keep it pointing straight down. By default, the lucide Magnet icon is angled/rotated -- adding `className="h-3 w-3 rotate-180"` or similar will orient the horseshoe magnet to point downward.

The icon size stays at `h-6 w-6` for the container and `h-3 w-3` for the icon itself.

---

## Files Modified

| File | Change |
|------|--------|
| Database migration | Add `default_transport_mode text default 'transit'` to `trips` |
| `src/pages/TripSettings.tsx` | Add "Default transport mode" selector |
| `src/pages/Timeline.tsx` | Change magnet snap to multi-mode directions call; use default mode for block sizing |
| `src/components/timeline/EntryCard.tsx` | Reposition magnet to card corner; fix icon rotation to point straight down |

## What Does NOT Change
- The `google-directions` edge function (already supports multi-mode)
- Transport connector rendering (already reads `transport_modes`)
- EntrySheet transport overview
- Lock icon styling
- Drag/resize behavior
