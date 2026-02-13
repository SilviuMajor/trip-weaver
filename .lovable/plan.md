
# Fix 1: Always Show Hotel Category + Fix 2: FAB Hotel Routing

## Changes

### 1. CategorySidebar.tsx

**A) Always show Hotel category** (line 189)

Replace the early return `if (dedupedEntries.length === 0) return null` with a check that allows `hotel` to always render. When the hotel section is empty, show a "No hotel added yet" placeholder.

```tsx
const alwaysShowCategories = ['hotel'];
// ...
if (dedupedEntries.length === 0 && !alwaysShowCategories.includes(cat.id)) return null;
```

When empty, render the header with the + button and a subtle placeholder text.

**B) Hotel dedup by hotel_id**

For hotel entries, group by `hotel_id` (from `entry.options[0].hotel_id`) instead of by `name::category`. Show one card per unique hotel. Legacy entries without `hotel_id` fall back to name-based dedup as before.

Modify `getFilteredOriginals` to check if category is `hotel` and use `hotel_id` as the dedup key when available.

**C) Temporary debug log**

Add `console.log('[CategorySidebar] entries:', entries.map(e => ({ id: e.id, cat: e.options[0]?.category, name: e.options[0]?.name })))` at the top of the component body.

### 2. EntrySheet.tsx

**A) Add `onHotelSelected` prop** to `EntrySheetProps` interface:

```tsx
onHotelSelected?: () => void;
```

**B) Intercept hotel category selection** in `handleCategorySelect` (line 706):

```tsx
const handleCategorySelect = (catId: string) => {
  if (catId === 'hotel' && onHotelSelected) {
    onHotelSelected();
    return;
  }
  // ... existing logic
};
```

### 3. Timeline.tsx

Pass the new prop to EntrySheet (~line 1686):

```tsx
<EntrySheet
  ...
  onHotelSelected={() => {
    setSheetOpen(false);
    setHotelWizardOpen(true);
  }}
/>
```

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/CategorySidebar.tsx` | Always show hotel section, hotel dedup by hotel_id, debug log |
| `src/components/timeline/EntrySheet.tsx` | Add `onHotelSelected` prop, intercept hotel category pick |
| `src/pages/Timeline.tsx` | Pass `onHotelSelected` to EntrySheet |

## What Does NOT Change

- HotelWizard, ContinuousTimeline, transport, flight systems
- Other category behavior in sidebar or EntrySheet
