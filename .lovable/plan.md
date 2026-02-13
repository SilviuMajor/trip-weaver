

# Fix Hotel Cards, Wizard Inputs, Timeline Labels, and Planner Drag

## Fix 1: Revert hotel card sizing changes in EntryCard.tsx

The previous change added a special compact variant for hotel utility blocks in the condensed layout (lines 522-575). This will be removed entirely so hotel check-in/checkout cards render identically to all other event cards.

**What changes:**
- Remove the `isHotelUtilityBlock` variable declaration (line 522)
- Remove the entire `if (isHotelUtilityBlock)` block inside `if (isCondensed)` (lines 526-575)
- Hotel cards will now use the same condensed layout as every other event card

---

## Fix 2: Compact inputs in HotelWizard Step 2

The date and time inputs on Step 2 (lines 722-778) use the default `Input` component which has `h-10` height. Add a className to reduce their height.

**What changes:**
- Add `className="h-8"` to all four `<Input>` fields in Step 2 (check-in date, check-in time, checkout date, checkout time)
- This matches compact input styling used elsewhere without changing the 2-column grid layout

---

## Fix 3: CHECK-IN and CHECKOUT aesthetic labels on timeline cards

Add small uppercase text badges to hotel utility blocks. These are purely decorative, not interactive.

**What changes in EntryCard.tsx:**

Detect hotel utility blocks using the existing name-based check:
- Check-in: `option.name?.startsWith('Check in ·')`
- Checkout: `option.name?.startsWith('Check out ·')` or `linkedType === 'checkout'`

For the **condensed layout** (the one that now renders identically to other cards after Fix 1): add a small "CHECK-IN" or "CHECKOUT" text label next to the category badge row.

For the **full-size layout**: same approach -- add the label in the top badge area.

Badge styling: `text-[8px] uppercase tracking-wider font-semibold text-muted-foreground` (or `text-white/60` over images). Not a colored badge, just small muted text.

- CHECK-IN label appears at the **top** of the card, next to the category badge
- CHECKOUT label appears at the **bottom** of the card, near the time/duration row

This applies to all card size variants (condensed and full), but NOT compact or medium (too small for labels).

---

## Fix 4: Planner sidebar representative selection for hotels

Currently, `CategorySidebar.tsx` groups hotel entries by `hotel_id` and uses `deduplicatedMap` which picks the earliest-created entry as the representative. Since check-in blocks are created first in HotelWizard, the check-in block becomes the representative.

**What changes in CategorySidebar.tsx:**

In `getFilteredOriginals`, when building hotel groups, prefer an overnight block (one whose name does NOT start with "Check in" or "Check out") as the representative. If no overnight block exists, fall back to whatever is available.

Implementation: Instead of relying on `deduplicatedMap` for hotel entries, find the best representative from the raw entries:

```
// For hotel groups, prefer an overnight block as representative
const hotelEntries = catEntries.filter(e => e.options[0]?.hotel_id === hotelId);
const overnight = hotelEntries.find(e => {
  const name = e.options[0]?.name ?? '';
  return !name.startsWith('Check in ·') && !name.startsWith('Check out ·');
});
const representative = overnight ?? hotelEntries[0];
```

This ensures the sidebar card shows the hotel name (not "Check in - Hotel Name"), the hotel image, and when dragged creates a normal hotel block.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/EntryCard.tsx` | Revert hotel utility block sizing; add CHECK-IN/CHECKOUT aesthetic labels |
| `src/components/timeline/HotelWizard.tsx` | Add `className="h-8"` to Step 2 date/time inputs |
| `src/components/timeline/CategorySidebar.tsx` | Prefer overnight block as hotel representative in sidebar |

## What Does NOT Change

- MapPreview / Uber button fixes from previous prompt
- Hotel wizard steps other than Step 2 field sizing
- Transport, flight, timeline rendering systems
- RouteMapPreview
