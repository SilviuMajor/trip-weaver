

# Category Menu Redesign — Vertical Grouped List

## Overview
Replace the 3-column emoji grid category picker with a vertical grouped list, update the search bar to pass through to the details step, and change the dinner emoji.

## Changes

### 1. Update dinner emoji in `src/lib/categories.ts` (line 24)
Change `emoji: '🍲'` to `emoji: '🍝'` for the dinner category.

### 2. Replace category picker in `src/components/timeline/EntrySheet.tsx` (lines 920-976)
Replace the entire `{step === 'category' && (...)}` block with the new vertical grouped layout:

- **Search bar**: Replace the custom `<input>` with the standard `<Input>` component, add `autoFocus`, and change behavior from calling `onExploreRequest` to instead setting `categoryId('activity')`, `setName(query)`, and `setStep('details')` on Enter. This passes the search query to the PlacesAutocomplete on the details step.

- **Transport suggestion**: Keep the existing `gapContext` button block exactly as-is (lines 923-945).

- **Category list**: Replace the 3-column grid with a vertical list grouped by type:
  - **Travel**: Flight, Hotel, Private Transfer
  - **Divider**
  - **Custom categories** (if any, from `allCategories` minus the predefined groups)
  - **Divider** (only if custom categories exist)
  - **Food and Drink**: Breakfast, Lunch, Coffee Shop, Dinner, Drinks, Nightlife
  - **Divider**
  - **Activities**: Sightseeing, Museum / Gallery, Park, Activity, Shopping

- Each list item: full-width button with emoji (28px centered column) + label (`text-sm font-medium`), `rounded-lg px-3 py-2.5`, hover `bg-accent/50`
- Dividers: `border-t border-border/50` with `my-1` spacing
- No group headers — dividers alone create visual separation

### 3. No import changes needed
`Search` is already imported from `lucide-react` (line 20). `Input` is already imported (line 7).

### What stays the same
- `handleCategorySelect` function — unchanged
- `allCategories` computation — unchanged
- `applySmartDefaults` — unchanged
- The `step === 'details'` block — unchanged
- All category IDs, colors, defaultDuration values — unchanged (except dinner emoji)
- `CategorySidebar.tsx`, `Planner.tsx` — untouched

## Files Modified
- `src/lib/categories.ts` — dinner emoji change
- `src/components/timeline/EntrySheet.tsx` — replace category picker block (lines 920-976)

