

# Add Notes Field to Event Cards

## Database Migration

Add a `notes` column to the `entries` table:

```sql
ALTER TABLE entries ADD COLUMN notes text DEFAULT NULL;
```

This is a nullable text column with no character limit.

## Type Update

Update the `Entry` interface in `src/types/trip.ts` to include `notes?: string | null`.

## EntryCard Changes (`src/components/timeline/EntryCard.tsx`)

**Props**: Add `notes?: string | null` to `EntryCardProps`.

**Full-size card (line ~810, after the location link and before the transfer/time sections)**: Insert a notes display block:
- Only render when `notes` is truthy
- Show text in `text-xs` with `text-muted-foreground` (or `text-white/70` when card has a background image)
- CSS: `line-clamp-2` for 2-line truncation with ellipsis
- Style: regular weight, slightly smaller than event name

**Condensed card (line ~650 area)**: Similar but even smaller (`text-[9px]`, `line-clamp-1`).

## EntrySheet Changes (`src/components/timeline/EntrySheet.tsx`)

**View mode (after the website field, around line 1387, before the Map section)**: Add an editable notes textarea:
- For editors: show a `<Textarea>` with placeholder "Add a note..."
- For non-editors: show notes text if present, otherwise nothing
- Save on blur using `supabase.from('entries').update({ notes }).eq('id', entry.id)` then call `onSaved()`
- Use a local `notesValue` state initialized from `entry.notes`

## CalendarDay Changes (`src/components/timeline/CalendarDay.tsx`)

Pass `notes={entry.notes}` to the `EntryCard` component (line ~879).

## Timeline.tsx

No changes needed -- the entries query already uses `select('*')` which will include the new `notes` column automatically.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `notes` text column to `entries` |
| `src/types/trip.ts` | Add `notes` to `Entry` interface |
| `src/components/timeline/EntryCard.tsx` | Add `notes` prop, render 2-line truncated notes on full-size and condensed cards |
| `src/components/timeline/EntrySheet.tsx` | Add editable textarea for notes in view mode |
| `src/components/timeline/CalendarDay.tsx` | Pass `notes` prop to EntryCard |

