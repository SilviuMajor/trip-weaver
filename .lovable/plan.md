

# Fix: Text flush-right on normal cards (> 30min)

## Problem

The content divs for normal (non-short) entries have constraints pushing text away from the right edge:

- **Condensed normal** (line 637): `max-w-[68%] px-3 py-2.5 pr-14` -- the `pr-14` (56px) creates unnecessary clearance
- **Full normal** (line 680): `max-w-[68%] p-4 pr-16` -- the `pr-16` (64px) is even worse

These large right paddings were likely leftover from when the pill and text shared the same space. On normal cards, the pill is at the top-right and the text is at the bottom-right -- they don't overlap vertically, so no clearance is needed.

## Fix

### 1. Condensed normal content div (line 637)

Change:
```
max-w-[68%] px-3 py-2.5 pr-14
```
To:
```
p-3 text-right items-end
```

Remove `max-w-[68%]` and `pr-14`. Keep `absolute bottom-0 right-0 z-10 text-right`.

### 2. Full normal content div (line 680)

Change:
```
max-w-[68%] p-4 pr-16
```
To:
```
p-3 text-right items-end
```

Remove `max-w-[68%]` and `pr-16`. Keep `absolute bottom-0 right-0 z-10 text-right`.

Both divs will become:
```tsx
<div className={cn('absolute bottom-0 right-0 z-10 text-right p-3', textColor)} style={{ pointerEvents: 'none' }}>
```

This ensures text is flush against the right edge with only 12px (p-3) breathing room.

## File: `src/components/timeline/EntryCard.tsx`

| Line | Current | Fixed |
|------|---------|-------|
| 637 | `'absolute bottom-0 right-0 z-10 text-right max-w-[68%] px-3 py-2.5 pr-14'` | `'absolute bottom-0 right-0 z-10 text-right p-3'` |
| 680 | `'absolute bottom-0 right-0 z-10 text-right max-w-[68%] p-4 pr-16'` | `'absolute bottom-0 right-0 z-10 text-right p-3'` |

Two single-line class changes. No structural modifications needed.
