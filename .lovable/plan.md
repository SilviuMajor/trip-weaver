

# Add New Categories, Hide System Categories, Update Emojis

## Overview
Add 4 new picker-visible categories (Nightlife, Coffee Shop, Museum/Gallery, Park), hide 4 system-only categories from pickers (Home, Transport, Transfer, Airport), update emojis for Breakfast/Dinner/Private Transfer, and unify filtering via a new `PICKER_CATEGORIES` export.

## Changes

### 1. `src/lib/categories.ts` -- Core definitions
- Add `pickerVisible?: boolean` to the `CategoryDef` interface.
- Replace the `PREDEFINED_CATEGORIES` array with the updated version containing 14 picker-visible and 4 system-only categories, with new emojis and reordered layout.
- Add `export const PICKER_CATEGORIES = PREDEFINED_CATEGORIES.filter(c => c.pickerVisible !== false);`

### 2. `src/components/timeline/EntrySheet.tsx` (~line 13, 415-416)
- Import `PICKER_CATEGORIES` alongside existing imports.
- Replace `PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing' && c.id !== 'transfer')` with `PICKER_CATEGORIES` in the `allCategories` construction.

### 3. `src/components/timeline/CategorySidebar.tsx` (~line 6, 58)
- Import `PICKER_CATEGORIES`.
- Replace the manual filter `PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing' && c.id !== 'transport' && c.id !== 'transfer')` with `[...PICKER_CATEGORIES]`.

### 4. `src/components/wizard/CategoryStep.tsx` (~line 5, 43)
- Import `PICKER_CATEGORIES` instead of `PREDEFINED_CATEGORIES`.
- Replace `PREDEFINED_CATEGORIES.map(...)` in the preview section with `PICKER_CATEGORIES.map(...)`.

### 5. `src/components/timeline/OptionForm.tsx` (~line 29)
- Import `PICKER_CATEGORIES`.
- Replace `PREDEFINED_CATEGORIES.map(...)` with `PICKER_CATEGORIES.map(...)` in the `allCategories` construction.

## What does NOT change
- `findCategory`, `categoryLabel`, `categoryColor` still search the full `PREDEFINED_CATEGORIES` array, so existing entries with home/transport/transfer/airport_processing render correctly.
- Database schema, flight/hotel special handling, transport auto-generation logic, timeline rendering.
