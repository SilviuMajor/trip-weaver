

# Add Budget Fields to Entry Options

## Overview
Replace the budget stub in PlaceOverview with real inline-editable budget fields backed by two new database columns. Budget section only appears for non-flight, non-transfer entries.

## Step 1: Database Migration

Add two nullable numeric columns to `entry_options`:

```sql
ALTER TABLE entry_options ADD COLUMN estimated_budget numeric(10,2) DEFAULT NULL;
ALTER TABLE entry_options ADD COLUMN actual_cost numeric(10,2) DEFAULT NULL;
```

## Step 2: Type Update

In `src/types/trip.ts`, add to the `EntryOption` interface (after `hotel_id`):

```typescript
estimated_budget: number | null;
actual_cost: number | null;
```

## Step 3: PlaceOverview Budget Section

Replace lines 906-916 (the budget stub Collapsible) with a real budget section that:

- Only renders when `option.category !== 'flight' && option.category !== 'transfer'`
- Uses a `Collapsible` with a dynamic header:
  - Both values set: "💰 €{actual} / €{estimated}"
  - Otherwise: "💰 Budget"
- Expanded content:
  - Two `InlineField` components (editors only) for estimated and actual, with € prefix and number formatting
  - Summary line logic:
    - Both set, actual <= estimated: green "€X under budget" (or "On budget" if equal)
    - Both set, actual > estimated: red "€X over budget"  
    - Only estimated: "Estimated: €X"
    - Only actual: "Spent: €X"
    - Neither: grey italic "Track spending for this activity"
  - Non-editors see plain read-only text with € values
- Saves via `supabase.from('entry_options').update(...)` on the option id, same pattern as `handleInlineSaveOption`

## Step 4: No Other Changes

Everything else in PlaceOverview, EntrySheet, and the rest of the app stays unchanged. The budget fields are purely additive.

## Technical Details

- The `InlineField` component already supports custom `renderDisplay` and `renderInput` props, which we'll use for the € prefix formatting
- Saving uses the existing `handleInlineSaveOption` pattern: `supabase.from('entry_options').update({ estimated_budget: value }).eq('id', option.id)` then call `onSaved()`
- Number parsing: `parseFloat(value)` on save, display with `.toFixed(2)` for consistency
- The Collapsible chevron rotation uses the same pattern as opening hours

