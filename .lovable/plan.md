

# Comprehensive Rewrite: EntryCard Pixel-Based Tiers + Lock-in-Pill

## Overview

Replace the current 4-tier system (compact/medium/condensed/full) with a 5-tier pixel-height system (micro/compact/tight/condensed/full), remove all duration-based sizing, unify pill styling, and add an inner clip container for proper rounded corners.

## Changes

### File 1: `src/components/timeline/EntryCard.tsx` (major rewrite)

**1. Remove duration-based variables (lines 157-161)**
Delete `durationMin`, `isShortEntry`, `isMicroEntry`. These are no longer used for layout decisions.

**2. Add `height` prop to interface (line 38)**
Add `height?: number` prop so the card can compute its own tiers internally. Remove `isCompact`, `isMedium`, `isCondensed` props from the interface.

**3. Compute 5 tiers from height (after props destructuring)**
```tsx
const h = height ?? 200;
const isMicro = h < 30;
const isCompactTier = h >= 30 && h < 72;
const isTight = h >= 72 && h < 86;
const isCondensedTier = h >= 86 && h < 116;
const isFull = h >= 116;
```

**4. Replace `durationPillStyle` with uniform styling**
Delete the current `durationPillStyle` function. Replace all pill instances with a single `DurationPill` inline pattern using:
- `fontSize: 10, padding: '3px 10px'` -- identical across ALL tiers
- `position: 'top-right'` for Full/Condensed/Tight, `position: 'center'` for Compact/Micro
- Lock icon + duration label
- All 4 stopPropagation handlers (onClick, onMouseDown, onTouchStart, onPointerDown)

**5. Replace `cornerFlag` helper**
Update to handle the micro tier's centered circle variant:
- Full: padding `5px 7px`, fontSize 13
- Condensed/Tight: padding `4px 6px`, fontSize 12
- Compact: padding `3px 5px`, fontSize 11
- Micro: centered circle at `left: 0`, vertically centered, `borderRadius: 999`

**6. Update `cardBase` wrapper**
Change overflow logic from `isShortEntry` to pixel-based:
- `overflow-visible` when `h < 45` (compact/micro)
- `overflow-hidden` otherwise
- Inner clip container already exists (lines 538-551) -- keep it

**7. Replace DIAGONAL_GRADIENTS**
Update to 5-tier fade gradients per the spec:
- full: `linear-gradient(148deg, transparent 15%, rgba(10,8,6,0.20) 25%, rgba(10,8,6,0.65) 38%, rgba(10,8,6,0.96) 50%)`
- condensed: `linear-gradient(148deg, transparent 10%, rgba(10,8,6,0.20) 20%, rgba(10,8,6,0.65) 33%, rgba(10,8,6,0.96) 45%)`
- tight: `linear-gradient(148deg, transparent 5%, rgba(10,8,6,0.25) 14%, rgba(10,8,6,0.70) 26%, rgba(10,8,6,0.97) 38%)`
- compact: `linear-gradient(148deg, transparent 0%, rgba(10,8,6,0.30) 8%, rgba(10,8,6,0.78) 18%, rgba(10,8,6,0.97) 28%)`
- micro: same as compact

**8. Rewrite all 5 render branches**

Replace the current 4 branches (compact/medium/condensed/full) with 5:

- **MICRO (<30px)**: Circle flag left-centered, pill center-right, title only (left:30, right:70), overflow-visible
- **COMPACT (30-71px)**: Tab flag top-left, pill center-right, title always + time if h>=45 (left:10, right:70), overflow-visible if h<45
- **TIGHT (72-85px)**: Tab flag top-left, pill top-right, title + time bottom-right (p: 6px 10px)
- **CONDENSED (86-115px)**: Tab flag top-left, pill top-right, title + rating + time bottom-right (p: 10px)
- **FULL (>=116px)**: Tab flag top-left, pill top-right, title + rating + address + time bottom-right (p-3)

All titles use `text-sm font-bold` (14px). No font size varies by tier.

**9. Delete the lock icon overlay (lines 740-747 equivalent -- already removed in previous edits)**
Confirm no standalone lock icon overlay remains.

### File 2: `src/components/timeline/ContinuousTimeline.tsx`

**1. Update tier computation (lines 1091-1093)**
Replace:
```tsx
const isCompact = height < 40 && !flightGroup;
const isMedium = height >= 40 && height < 80 && !flightGroup;
const isCondensed = height >= 80 && height < 160 && !flightGroup;
```
With: just pass `height` as a prop to EntryCard. The card computes its own tiers internally.

**2. Update EntryCard props (line 1389-1391)**
Replace `isCompact={isCompact} isMedium={isMedium} isCondensed={isCondensed}` with `height={height}`.

**3. Update drag ghost tier computation (lines 1758-1760 and 1809-1811)**
Same change for the two drag ghost EntryCard renderings -- pass `height={moveHeight}` instead of the three boolean props.

**4. Update resize handle visibility (lines 1227, 1241, 1487, 1499)**
Replace `!isCompact` checks with `height >= 72` (tight and above show resize handles).

**5. Transport card tier checks**
The transport card inside EntryCard still uses `isCompact`/`isMedium`/`isCondensed` from props. These will be replaced with internal tier computation from the `height` prop. The transport card tiers can remain as-is functionally (compact < 72, condensed >= 72, full >= 116) or keep their existing pixel breakpoints since transport cards have different visual needs.

### Files NOT modified
- FlightGroupCard.tsx -- separate component, unchanged
- TransportConnector.tsx -- separate component, unchanged
- All other timeline components -- unchanged

## Summary of prop changes

| Old prop | New prop |
|----------|----------|
| `isCompact?: boolean` | removed |
| `isMedium?: boolean` | removed |
| `isCondensed?: boolean` | removed |
| (none) | `height?: number` |

The `height` prop replaces all three tier booleans. EntryCard computes tiers internally.

