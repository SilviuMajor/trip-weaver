

# Fix Hotel Card Titles and CHECKOUT Badge Position

## Fix 1: Strip "Check in · " and "Check out · " prefixes from card titles

In `EntryCard.tsx`, create a display name variable after the existing `isCheckIn`/`isCheckOut` detection (line 524):

```tsx
const displayName = isCheckIn
  ? option.name?.replace(/^Check in · /, '') ?? option.name
  : isCheckOut && option.name?.startsWith('Check out · ')
    ? option.name?.replace(/^Check out · /, '')
    : option.name;
```

Then replace all `{option.name}` references in the card rendering with `{displayName}`:
- Line 577 (condensed layout title)
- Line 723 (full-size layout title)

The `option.name` used in the `alt` attribute for images (line 553) can stay as-is.

## Fix 2: CHECKOUT badge pinned to absolute bottom of card

Currently the CHECKOUT badge sits inline in the content flow (lines 619-621 in condensed, lines 839-841 in full-size). For tall checkout blocks, it needs to be at the very bottom edge.

**Condensed layout (line 619-621):**
- Remove the inline CHECKOUT span from inside the bottom flex row
- Add an absolutely-positioned CHECKOUT span as a direct child of the card container (the `motion.div`), just before the overlap div:
```tsx
{isCheckOut && (
  <span className={cn(
    'absolute bottom-1 left-2.5 z-10 text-[10px] font-semibold uppercase tracking-wider',
    firstImage ? 'text-white/60' : 'text-muted-foreground/70'
  )}>checkout</span>
)}
```

**Full-size layout (line 839-841):**
- Same approach: remove the inline CHECKOUT span from the bottom row
- Add an absolutely-positioned span as a child of the outer card container

The card containers already use `relative` positioning (via the `motion.div` with `overflow-hidden`), so absolute positioning will work.

CHECK-IN badges stay where they are (top of card, inline with content) -- no change needed.

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/EntryCard.tsx` | Add `displayName` variable; replace `option.name` with `displayName` in titles; move CHECKOUT badges to absolute bottom positioning |

## What Does NOT Change
- Database values (names stored as "Check in · Hotel Name")
- EntrySheet / overview display
- MapPreview, HotelWizard, transport, flights
- CHECK-IN badge positioning (stays at top, inline)

