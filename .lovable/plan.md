
# Hotel-Aware Delete Dialog in EntrySheet

## Overview

When deleting a hotel entry (one with `hotel_id` on its option), show a 3-button dialog instead of the standard 2-button one. Non-hotel entries remain unchanged.

---

## Changes to `src/components/timeline/EntrySheet.tsx`

### Replace the delete AlertDialog (lines 1698-1723)

Add conditional logic: if the current `option` has a `hotel_id`, render the hotel-specific dialog; otherwise render the existing generic one.

### Hotel-specific dialog

**State additions:**
- `hotelBlockCount: number` -- count of all entries sharing this `hotel_id`
- Fetched on dialog open (when `deleting` becomes true and option has `hotel_id`)

**On dialog open** (useEffect watching `deleting`):
```tsx
if (deleting && option?.hotel_id) {
  // Query entry_options with same hotel_id to get count
  const { data } = await supabase
    .from('entry_options')
    .select('entry_id')
    .eq('hotel_id', option.hotel_id);
  setHotelBlockCount(data?.length ?? 0);
}
```

**Dialog content:**
- Title: "Delete hotel block"
- Description: "Do you want to delete just this block, or all blocks for {option.name}?"
- Three vertically stacked full-width buttons:

1. **"Delete All -- {count} blocks"** (destructive red):
   - Query `entry_options` where `hotel_id` matches to get all `entry_id`s
   - Delete from `entries` where `id` in that list
   - Delete from `hotels` where `id` = `hotel_id`
   - Close sheet, call `onSaved()`

2. **"Just This Block"** (outline):
   - Delete single entry by `entry.id` (existing logic)
   - Close sheet, call `onSaved()`

3. **"Cancel"** (ghost):
   - Close dialog

**Layout**: Use a `flex flex-col gap-2` container instead of the standard `AlertDialogFooter` row layout.

### Non-hotel entries

Keep the existing 2-button dialog exactly as-is (lines 1698-1723).

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/EntrySheet.tsx` | Hotel-aware delete dialog with 3 buttons, hotel block count fetch |

## What Does NOT Change

- HotelWizard, transport, flight systems
- Non-hotel delete behavior
- Timeline rendering, EntryCard
