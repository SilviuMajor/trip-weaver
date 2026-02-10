

# Toast + Shake Feedback for Locked Entry Drag Attempts

## What Changes

When a user tries to drag a locked event (mousedown/touchstart on the card body, or on the resize handles), the card will briefly shake and a toast will appear saying "Cannot drag a locked event".

## Changes

### 1. Add shake keyframe (`tailwind.config.ts`)

Add a `shake` keyframe and animation utility so we can apply `animate-shake` to any element:

```
shake: { 0%, 100%: translateX(0), 20%, 60%: translateX(-4px), 40%, 80%: translateX(4px) }
```

Duration: 0.4s

### 2. Add locked-drag feedback in `CalendarDay.tsx`

- Import `toast` from `sonner`
- Add a `shakeEntryId` state (string | null) that clears after 400ms
- Create a `handleLockedAttempt(entryId)` function that:
  1. Sets `shakeEntryId` to the entry ID
  2. Shows `toast.error("Cannot drag a locked event")`
  3. Clears `shakeEntryId` after 400ms via setTimeout
- For locked entries (`!canDrag && isLocked`):
  - Pass `onDragStart` as a handler that calls `handleLockedAttempt` instead of `undefined`
  - Same for `onTouchDragStart`
  - Add the resize handle divs but wired to `handleLockedAttempt` on mousedown/touchstart
- Apply `animate-shake` class to the card wrapper div when `shakeEntryId === entry.id`

### 3. Pass shake state through to `EntryCard` and `FlightGroupCard`

Add an optional `isShaking?: boolean` prop. When true, add `animate-shake` to the card's root element. This keeps the animation on the actual card DOM node.

---

## File Summary

| File | Changes |
|------|---------|
| `tailwind.config.ts` | Add `shake` keyframe + `animate-shake` utility |
| `src/components/timeline/CalendarDay.tsx` | Add `shakeEntryId` state, `handleLockedAttempt` function, wire locked cards to show toast + trigger shake |
| `src/components/timeline/EntryCard.tsx` | Accept `isShaking` prop, apply `animate-shake` class when true |
| `src/components/timeline/FlightGroupCard.tsx` | Accept `isShaking` prop, apply `animate-shake` class when true |

No database changes. No edge function changes.

---

## Technical Details

**handleLockedAttempt:**
```typescript
const [shakeEntryId, setShakeEntryId] = useState<string | null>(null);

const handleLockedAttempt = useCallback((entryId: string) => {
  toast.error('Cannot drag a locked event');
  setShakeEntryId(entryId);
  setTimeout(() => setShakeEntryId(null), 400);
}, []);
```

**Wiring for locked entries (CalendarDay.tsx line ~651):**
```typescript
onDragStart={canDrag ? (e) => {
  onMouseDown(e as any, entry.id, 'move', ...);
} : isLocked ? (e) => {
  e.stopPropagation();
  handleLockedAttempt(entry.id);
} : undefined}
```

**Shake keyframe (tailwind.config.ts):**
```typescript
"shake": {
  "0%, 100%": { transform: "translateX(0)" },
  "20%, 60%": { transform: "translateX(-4px)" },
  "40%, 80%": { transform: "translateX(4px)" },
}
// animation: { "shake": "shake 0.4s ease-in-out" }
```
