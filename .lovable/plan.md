

# Card Interaction Overhaul -- No Push, Explicit Snap Only

Three changes to make cards feel stable: they only move when the user explicitly drags or snaps them.

---

## 1. Remove Smart Drop Push

**File:** `src/pages/Timeline.tsx` (lines 1579-1653)

Delete the entire "Smart Drop" block from `handleEntryTimeChange`. This includes:
- The overlap detection logic (lines 1579-1588)
- The push-down logic for unlocked overlapped cards (lines 1591-1648)
- The locked card overlap toast (lines 1649-1653)

After deletion, the code flows directly from the transport reposition `} catch` block (line 1575-1577) to the auto-extend trip check (line 1655).

---

## 2. Remove Auto-Transport on Plain Drops

Transport creation should only happen via explicit snap (magnet lock during drag). Three auto-transport blocks need removal:

### 2a. `handleEntryTimeChange` adjacency check (lines 1552-1574)

Delete the "Check if we need to create NEW transport" block that runs after transport repositioning. Keep the `} catch` on line 1575.

### 2b. `handleDropOnTimeline` adjacency check (lines 1962-1988)

Delete the "Auto-create transport for nearby adjacent cards" block. The toast at line 1990 and the opening hours check above it both remain.

### 2c. `handleDropExploreCard` adjacency check (lines 2021-2047)

Delete the "Auto-create transport for nearby adjacent cards" block inside `if (newEntryId)`. The `handleSnapRelease` dependency in the `useCallback` deps array (line 2048) should also be removed.

---

## 3. Reduce Snap Magnet Threshold (20min to 15min)

**File:** `src/components/timeline/ContinuousTimeline.tsx` (line 783)

Change `SNAP_THRESHOLD_HOURS = 20 / 60` to `SNAP_THRESHOLD_HOURS = 15 / 60`.

---

## What Stays Unchanged

- `handleSnapRelease` itself (creates transport on explicit snap)
- Transport reposition on move (existing transports follow their cards)
- `handleChainShift` (block resize shifts)
- `handleGroupDrop` (group drag)
- `computeOverlapLayout` (visual overlap columns)
- Auto-generate-transport edge function (batch operation)

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Delete Smart Drop block, delete 3 auto-transport adjacency checks |
| `src/components/timeline/ContinuousTimeline.tsx` | Snap threshold 20min to 15min |

