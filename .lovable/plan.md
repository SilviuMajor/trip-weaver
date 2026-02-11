

# Change 1: Remove Transport from Trip Events Panel + Change 2: Rework "Add Something" Modal

## Overview

Two changes: (1) fully exclude transport/transfer entries from the Trip Events sidebar and remove the "Move to ideas" action for transport entries, and (2) rework the category picker in EntrySheet to remove "Transfer" as a standalone option and instead show a contextual transport suggestion when adding between two events.

---

## Change 1: Remove Transport from Trip Events Panel

### CategorySidebar.tsx

The sidebar already filters out `transport` and `airport_processing` categories (lines 47, 123, 142). The `transfer` category is the one actually used for transport connectors, and it also needs filtering. However, looking at the code, `transfer` entries are already being grouped under the "Transfer" predefined category -- they show up because `PREDEFINED_CATEGORIES` includes `transfer` and the sidebar includes it in `allCategories`.

**Fix**: Add `transfer` to the exclusion filter alongside `airport_processing` and `transport` in:
- Line 47: `PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing' && c.id !== 'transport' && c.id !== 'transfer')`
- Line 123: `if (catId === 'airport_processing' || catId === 'transport' || catId === 'transfer') continue;`
- Line 142: same filter for totalCount

### EntrySheet.tsx (View Mode)

Hide the "Move to ideas" button when viewing a transport/transfer entry.

- Around line 1377: Add a condition to hide the button when `option.category === 'transfer'`

---

## Change 2: Rework the "Add Something" Modal

### Step A: Remove "Transfer" from the category picker

**EntrySheet.tsx** line 233-234: The `allCategories` list currently only filters `airport_processing`. Add `transfer` to the filter:
```
PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing' && c.id !== 'transfer')
```

### Step B: Pass gap context to "Add Something"

Currently, `handleAddBetween` in Timeline.tsx (line 389) only passes `prefillTime` and clears `transportContext`. To show the transport suggestion in the category picker, we need to know which two entries border the gap.

**CalendarDay.tsx**: Update gap button `onAddBetween` calls to also pass the from/to entry IDs and names:
- Change the `onAddBetween` prop signature to accept optional context: `(prefillTime: string, gapContext?: { fromEntryId: string; toEntryId: string; fromName: string; toName: string; fromAddress: string; toAddress: string }) => void`
- At line 530-531 (the non-transport gap in between two entries), pass the adjacent entry info
- At line 487 (remaining gap after transport), pass context from the transport's end to the next entry
- Small + buttons on cards (lines 944-971) are for quick-add without a clear "between" context, so no gap context passed

**Timeline.tsx**: Update `handleAddBetween` to accept and store the gap context:
- Store a new state `gapContext` with from/to entry names and addresses
- Pass it to EntrySheet as a new prop

**EntrySheet.tsx**: Show contextual transport suggestion at the top of the category picker:
- Accept a new `gapContext` prop with `fromEntryId`, `toEntryId`, `fromName`, `toName`, `fromAddress`, `toAddress`
- In the `step === 'category'` render block (line 1432), before the category grid, render a transport suggestion card if `gapContext` exists and both `fromName` and `toName` are present
- Label: "Transport from [fromName] to [toName]" with a bus/route icon
- Tapping it sets `categoryId` to `'transfer'`, pre-fills `transferFrom`/`transferTo` from gapContext addresses, and jumps to the details step (which triggers the route fetch)
- If only one side has an entry (no `toName` or no `fromName`), do not show the suggestion

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/CategorySidebar.tsx` | Add `transfer` to exclusion filters (lines 47, 123, 142) |
| `src/components/timeline/CalendarDay.tsx` | Update `onAddBetween` calls to pass gap context (from/to entry names and addresses) |
| `src/pages/Timeline.tsx` | Update `handleAddBetween` to accept and store gap context; pass to EntrySheet |
| `src/components/timeline/EntrySheet.tsx` | Filter `transfer` from category picker; add contextual transport suggestion card; hide "Move to ideas" for transfer entries |

## What Is NOT Changed

- Transport connector rendering or inline editing on the timeline
- The gap detection logic for when buttons appear
- Flight or other event type options in the modal
- Transport auto-route generation or mode switching

