

# Lock Guard + Dead Code Cleanup

## Summary
Three changes: add lock guards to prevent locked cards from being indirectly moved, clean up unused state in `useTravelCalculation`, and remove the fallback drag block in `useDragResize`. Two items from the original prompt are already resolved or incorrect:
- **Image filter (Bug Fix 2)**: Already fixed -- lines 278-285 of Timeline.tsx already filter `option_images` by `optionIds`.
- **Delete overlapLayout.ts**: This file IS actively used -- imported at ContinuousTimeline.tsx line 11 and called at line 657. It must NOT be deleted.

---

## Bug Fix 1: Lock Guard in `handleEntryTimeChange`

**File: `src/pages/Timeline.tsx`**

### 1a. Early return for locked entries (line 1175)
After `const entry = entries.find(...)`, add:
```typescript
if (entry?.is_locked && !entry.linked_flight_id) return;
```
This prevents locked cards from being moved by any code path (e.g., smart-drop push-down logic).

### 1b. Skip transport reposition when destination is locked (line 1208 loop)
Inside the `for (const transport of linkedTransports)` loop, after the `if (!fromId || !toId) continue;` check, add:
```typescript
const toEntry = entries.find(e => e.id === toId);
if (toEntry?.is_locked) continue;
```
This prevents transports linked to locked cards from being repositioned when an adjacent unlocked card is dragged.

---

## Cleanup 1: Remove unused state from `useTravelCalculation`

**File: `src/hooks/useTravelCalculation.ts`**

- Remove `useState` import usage for `calculating` and `results` (lines 13-14)
- Remove `setCalculating(true)` (line 21), `setResults(...)` (lines 76-78), `setCalculating(false)` (line 80)
- Return only `{ calculateTravel }` instead of `{ calculating, results, calculateTravel }`
- The caller at Timeline.tsx line 185 already destructures only `{ calculateTravel }`, so no caller changes needed

---

## Cleanup 2: Remove fallback delta-based drag in `useDragResize.ts`

**File: `src/hooks/useDragResize.ts` (lines 249-275)**

Remove the entire fallback block from `// Fallback: delta-based (if no scroll container)` through the end of the `handlePointerMove` logic (before the closing dependency array `], [...]`). The scroll container is always provided by ContinuousTimeline, making this code unreachable.

---

## What is NOT changed
- `src/lib/overlapLayout.ts` -- actively used in ContinuousTimeline.tsx, NOT dead code
- Image query in `fetchData()` -- already filtered by optionIds
- `calculateTravel` function logic itself -- still needed for drop conflict analysis

## Testing
- Lock a card, drag an adjacent unlocked card onto its time slot -- locked card should not move
- Drag an unlocked card with transport linked to a locked card -- transport should not reposition
- Flight sub-entries (checkin/checkout) should still move when parent flight is dragged
- Verify all cards still render images correctly
- Build should compile cleanly

