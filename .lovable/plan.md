

# Transport Card Visual Refresh + Distance Display + Live Refresh

## Overview

Three changes to the transport timeline card and its supporting infrastructure:

1. **Visual redesign**: Orange-tinted background, large centered emoji on the left, distance shown on card, playful styling
2. **Distance display**: Show distance (km/m) on all transport card sizes
3. **Refresh button**: Re-fetch all travel modes for the scheduled departure time, auto-resize the block if duration changes, trigger Conflict Resolver on overflow

---

## 1. Visual Redesign (EntryCard.tsx -- transport variants)

All four transport card layouts get an orange-tinted warm background instead of the subtle category-tinted one.

### Full layout (largest)

```text
+--------------------------------------------------+
|  [large emoji]  |  Walk to Restaurant Y           |
|   centered      |  12m (transit) . 0.8km           |
|   vertically    |  +2m buffer                      |
|                 |  09:30 -- 09:42         [refresh] |
|                 |  [mini route map]                 |
+--------------------------------------------------+
```

- Background: warm orange tint (`bg-orange-50` / `hsl(30, 100%, 97%)` in light mode)
- Left section: large emoji (text-3xl) centered vertically in a subtle circle/pill
- Right section: name, duration + distance, contingency, time row, mini map
- Dashed left border stays but in orange
- Refresh icon button (small, top-right corner)

### Condensed layout (80-160px)

```text
+-------------------------------------------+
| [emoji lg]  Walk to Restaurant . 12m 0.8km |
|             09:30 -- 09:42        [refresh] |
+-------------------------------------------+
```

### Medium layout (40-80px)

```text
+-------------------------------------------+
| [emoji]  Walk to Restaurant Y  12m . 0.8km |
+-------------------------------------------+
```

### Compact layout (< 40px)

```text
+-------------------------------+
| [emoji]  12m . 0.8km          |
+-------------------------------+
```

All variants use `bg-orange-50 dark:bg-orange-950/20` as the background tint.

---

## 2. Distance Display

Currently the transport card does NOT show distance -- only duration. The distance is available from the `google-directions` response and is stored alongside the transport entry.

### Where distance comes from

When a transport entry is saved, the selected route's `distance_km` should be stored in the `entry_options` table. Currently `distance_km` is NOT a column on `entry_options` -- it exists on `travel_segments`. We need to either:

**Option A (simpler)**: Store `distance_km` alongside `route_polyline` in entry_options (new column)
**Option B**: Read from travel_segments at display time

We'll go with **Option A** -- add a `distance_km` column to `entry_options`. This is already consistent with how `route_polyline` was added.

### Display format

- Under 1km: show in meters (e.g., "800m")
- 1km+: show with one decimal (e.g., "1.2km")

---

## 3. Refresh Button -- Live Travel Time Update

A small refresh/sync icon button on transport cards. When tapped:

1. Calls `google-directions` with **all modes** (`walk`, `transit`, `drive`, `bicycle`) using the entry's scheduled start time as `departureTime`
2. Shows a quick inline picker if the user wants to switch modes (or keeps current)
3. Auto-resizes the transport block:
   - New `blockDuration = Math.ceil(newDurationMin / 5) * 5`
   - Updates `end_time` on the entry
   - Updates `distance_km` and `route_polyline` on the option
   - If the new block overflows into the next entry, triggers the Conflict Resolver

### Refresh flow

```text
User taps refresh icon
    |
    v
Spinner on icon, fetch all modes with departureTime = entry.start_time
    |
    v
Show mini modal/popover with updated mode options:
  Walk:    15m  1.2km  [selected if current]
  Transit: 12m  1.0km
  Drive:    8m  3.4km
  Cycle:   10m  1.1km
    |
    v
User picks mode (or keeps current)
    |
    v
Auto-update entry end_time (rounded up to 5m), distance, polyline
    |
    v
If new block > gap to next entry -> trigger Conflict Resolver
```

---

## File Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/timeline/EntryCard.tsx` | Edit | Orange tint background, larger centered emoji, distance display on all sizes, refresh button with popover |
| `src/components/timeline/EntrySheet.tsx` | Edit | Store `distance_km` when saving transport entries |
| Database migration | Create | Add `distance_km NUMERIC` column to `entry_options` |

No edge function changes (existing `google-directions` already supports multi-mode with `departureTime`).

---

## Technical Details

### Database Migration

```sql
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS distance_km NUMERIC;
```

### EntryCard transport styling

Replace current transport background:
```text
-- Before: style={{ background: `${catColor}0a` }}
-- After:  className="bg-orange-50 dark:bg-orange-950/20"
```

Left emoji section:
```text
<div className="flex items-center justify-center w-14 shrink-0">
  <span className="text-3xl">{mode.emoji}</span>
</div>
```

### Distance formatting helper

```typescript
const formatDistance = (km: number | null | undefined): string => {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
};
```

### Refresh handler (inside EntryCard)

```typescript
const handleRefresh = async (e: React.MouseEvent) => {
  e.stopPropagation();
  setRefreshing(true);

  const { data } = await supabase.functions.invoke('google-directions', {
    body: {
      fromAddress: option.departure_location,
      toAddress: option.arrival_location,
      modes: ['walk', 'transit', 'drive', 'bicycle'],
      departureTime: startTime,   // scheduled ISO time
    },
  });

  setRefreshResults(data?.results ?? []);
  setShowRefreshPopover(true);
  setRefreshing(false);
};
```

### Mode selection after refresh

When user picks a mode from the refresh popover:
1. Compute `blockDuration = Math.ceil(selectedResult.duration_min / 5) * 5`
2. Compute new `endTime = startTime + blockDuration minutes`
3. Update the entry: `supabase.from('entries').update({ end_time: newEndIso }).eq('id', entryId)`
4. Update the option: `supabase.from('entry_options').update({ distance_km, route_polyline, name: 'ModeName to ...' }).eq('id', option.id)`
5. Call `onVoteChange()` to trigger data refresh
6. If new endTime overlaps with the next entry on the timeline, the parent Timeline component detects this via its existing conflict detection and triggers the Conflict Resolver

### Saving distance_km on transport creation (EntrySheet.tsx)

In the save handler, when creating a transfer entry with a selected route, include `distance_km` in the option insert:
```text
distance_km: selectedRoute?.distance_km ?? null,
route_polyline: selectedRoute?.polyline ?? null,
```

