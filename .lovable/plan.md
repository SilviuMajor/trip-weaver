

# Move lock toggle into the duration pill

## Overview
Remove the standalone lock button from ContinuousTimeline.tsx and the lock icon overlay from EntryCard.tsx. Instead, integrate the lock state indicator and toggle directly into the duration pill on every card tier.

## Changes

### File 1: `src/components/timeline/ContinuousTimeline.tsx`

**Delete the standalone lock button (lines 1445-1463)**
Remove the entire block:
```tsx
{/* Lock icon outside card — right side */}
{isEditor && onToggleLock && (
  <button ... >
    ...
  </button>
)}
```

**Pass `onToggleLock` to EntryCard** -- find where EntryCard is rendered (around line 1277) and add the prop:
```tsx
onToggleLock={() => onToggleLock?.(entry.id, !!isLocked)}
```

Also remove the `Lock` and `LockOpen` imports if they become unused (they may still be used elsewhere in the file).

### File 2: `src/components/timeline/EntryCard.tsx`

**1. Delete the lock icon overlay (lines 740-747)**
Remove:
```tsx
{/* Lock icon */}
{isLocked && (
  <div className="absolute top-2.5 left-[50%] -translate-x-1/2 z-20">
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary">
      <Lock className="h-3 w-3 text-primary-foreground" />
    </span>
  </div>
)}
```

**2. Replace all duration pill `<div>` elements with lock-aware pills**

Currently there are 5 pill instances rendering just `{durationLabel}`:
- Line 575 (compact): `<div style={durationPillStyle('xs', isShortEntry)}>{durationLabel}</div>`
- Line 594 (medium): `<div style={durationPillStyle('s', isShortEntry)}>{durationLabel}</div>`
- Line 625 (condensed): `<div style={durationPillStyle('m', isShortEntry)}>{durationLabel}</div>`
- Line 665 (full): `<div style={durationPillStyle('l', isShortEntry)}>{durationLabel}</div>`

Each will become a clickable pill with lock icon. For normal (top-right) pills:
```tsx
<div
  className="absolute z-20 rounded-full font-bold flex items-center gap-1 cursor-pointer select-none"
  style={{
    ...durationPillStyle('m', isShortEntry),
    background: isLocked ? 'rgba(224, 138, 58, 0.85)' : undefined,
    border: isLocked ? '1px solid rgba(224, 138, 58, 0.4)' : undefined,
  }}
  onClick={(e) => { e.stopPropagation(); onToggleLock?.(); }}
>
  {isLocked ? <Lock className="h-2.5 w-2.5" /> : <LockOpen className="h-2.5 w-2.5 opacity-60" />}
  <span>{durationLabel}</span>
</div>
```

The `durationPillStyle` function already sets position, font, padding, backdrop-filter, and the default frosted-glass background. When `isLocked`, we override `background` and `border` to orange. When unlocked, the existing frosted glass styles from `durationPillStyle` remain.

For centered pills (compact/short cards), same pattern but `durationPillStyle` is called with `centered = true`.

**3. Update `durationPillStyle` to support lock override**

Modify the function to add `display: 'flex'`, `alignItems: 'center'`, `gap: 4`, and `cursor: 'pointer'` to the base style object so all pills support the icon layout.

**4. Keep existing imports** -- `Lock` and `LockOpen` are already imported in EntryCard.tsx.

## What stays unchanged
- `isLocked` prop on EntryCard (still passed)
- `handleLockedAttempt` toast logic in ContinuousTimeline (still works for drag attempts)
- Magnet button position and behavior
- `onToggleLock` callback signature
- `isLocked` border styling on transport cards
