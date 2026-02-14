
# Six Targeted Fixes

## Fix 1 -- TZ badge positioning

### File: `src/components/timeline/ContinuousTimeline.tsx` (line 1515)

Change `left: -100, width: 46` to `left: -78, width: 58` and `z-[6]` to `z-[16]`:

```jsx
<div key={`tz-${dayIndex}`} className="absolute z-[16]" style={{ top: badgeTop, left: -78, width: 58 }}>
```

This keeps the badge within the 80px gutter (ml-20) so it won't clip.

## Fix 2 -- Reverse magnet locked state (show greyed, not hidden)

### File: `src/components/timeline/ContinuousTimeline.tsx`

Three magnet button locations need updating:

**Transport connector magnet (line 1245)**: Change `{magnetState.showMagnet && !magnetState.nextLocked && (` back to `{magnetState.showMagnet && (`. Restore conditional styling on the button className and onClick handler with locked toast. Restore conditional icon color.

**Regular card magnet (line 1333)**: Same changes as above.

**Flight group magnet (line 1181)**: Same changes as above.

For all three, the button becomes:
```jsx
{magnetState.showMagnet && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (magnetState.nextLocked) {
        toast('Next event is locked', { description: 'Unlock it before snapping' });
        return;
      }
      if (!onMagnetSnap) return;
      setMagnetLoadingId(entry.id);
      onMagnetSnap(entry.id).finally(() => setMagnetLoadingId(null));
    }}
    className={cn(
      "absolute -bottom-3 -right-3 z-[45] flex h-7 w-7 items-center justify-center rounded-full border border-border shadow-sm",
      magnetState.nextLocked
        ? "bg-muted cursor-not-allowed"
        : "bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/50 cursor-pointer",
      magnetLoadingId === entry.id && "animate-pulse"
    )}
  >
    {magnetLoadingId === entry.id ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-green-600" />
    ) : (
      <Magnet className={cn("h-3 w-3", magnetState.nextLocked ? "text-muted-foreground/40" : "text-green-600 dark:text-green-400")} style={{ transform: 'rotate(180deg)' }} />
    )}
  </button>
)}
```

Need to verify `toast` (sonner) is imported in ContinuousTimeline -- it uses `toast` from sonner already.

## Fix 3 -- Hold-to-detach: increase stillness threshold + reduce timer + haptic

### File: `src/components/timeline/ContinuousTimeline.tsx` (lines 522, 524, 528)

- Line 522: Change `< 5` to `< 20`
- Line 524 (setTimeout): Change `500` to `400`
- Line 528 (inside setTimeout callback, after setDetachedDrag): Add `if (navigator.vibrate) navigator.vibrate(50);`

## Fix 4 -- Remove Tier 1 auto-snap

### File: `src/pages/Timeline.tsx` (lines 1078-1126)

Delete the entire `// Tier 1 auto-snap` block (lines 1078-1126), keeping the transport repositioning code above it (lines 1060-1076) and the catch/finally below.

## Fix 5 -- Drag snap granularity 15min to 5min

### File: `src/hooks/useDragResize.ts` (line 27)

Change `const SNAP_MINUTES = 15;` to `const SNAP_MINUTES = 5;`

## Fix 6 -- Add Private Transfer category

### File: `src/lib/categories.ts` (line 29, after transport)

Insert before the closing `];`:
```typescript
{ id: 'private_transfer', name: 'Private Transfer', emoji: '🚙', color: 'hsl(220, 50%, 50%)', defaultDurationMin: 45, defaultStartHour: 9, defaultStartMin: 0 },
```

The CategorySidebar filter (line 58) only excludes `airport_processing`, `transport`, and `transfer` -- `private_transfer` will appear in the picker automatically.

## Files changed

1. `src/components/timeline/ContinuousTimeline.tsx` -- TZ badge position, magnet locked state restored, hold-to-detach tuning
2. `src/pages/Timeline.tsx` -- remove Tier 1 auto-snap block
3. `src/hooks/useDragResize.ts` -- snap granularity 15min to 5min
4. `src/lib/categories.ts` -- add Private Transfer category

## What does NOT change

- Magnet snap handler logic (handleMagnetSnap)
- Flight group magnet rendering structure
- Transport repositioning on drag (kept)
- Card overview / EntrySheet
- Planner drag / touch drag
