

# Remove Magnet System + Transport Gap Buttons

## Overview
Remove the entire magnet/snap system and transport gap buttons from both Timeline.tsx and ContinuousTimeline.tsx. The auto-connector system (from Prompt 2) replaces their function.

## Changes

### Timeline.tsx

**1. Delete `handleMagnetSnap` (lines 705-919)**
The entire `useCallback` that handles magnet snap logic (transport-source path, transport-exists case, no-transport case with directions API call). ~215 lines removed.

**2. Delete `checkProximityAndPrompt` (lines 1179-1227)**
The proximity toast callback that asks "Generate transport & snap?" ~49 lines removed.

**3. Remove `checkProximityAndPrompt` call sites:**
- Line 1631: Delete `checkProximityAndPrompt(entryId);` from `handleEntryTimeChange`
- Line 1910: Delete `checkProximityAndPrompt(placedEntryId);` from `handleDropOnTimeline`

**4. Delete `handleAddTransport` (lines 1336-1365)**
Opens EntrySheet for manual transport creation from gap buttons. No longer needed.

**5. Delete `handleGenerateTransportDirect` (lines 1367-1483)**
Auto-generates transport from gap buttons. No longer needed.

**6. Remove prop passing to ContinuousTimeline (lines 2815-2816, 2836):**
- Delete `onAddTransport={handleAddTransport}`
- Delete `onGenerateTransport={handleGenerateTransportDirect}`
- Delete `onMagnetSnap={handleMagnetSnap}`

### ContinuousTimeline.tsx

**7. Remove from interface + destructuring:**
- `onAddTransport` prop (line 47)
- `onGenerateTransport` prop (line 48)
- `onMagnetSnap` prop (line 62)
- Corresponding destructuring lines (98-99, 113)

**8. Delete `magnetLoadingId` state (line 465)**

**9. Delete the `magnetState` IIFE (lines 1383-1431)**
The entire computation block that determines whether to show magnet buttons, checks for transport entries after, locked state, etc.

**10. Delete magnet button on flight groups (lines 1598-1626)**
The `{magnetState.showMagnet && (` block inside the flight group card rendering.

**11. Delete magnet button on regular cards (lines 1687-1714)**
The `{magnetState.showMagnet && (` block inside the regular card rendering.

**12. Replace transport gap button with "+ Add something" (lines 1229-1245)**
Remove the `isTransportGap` variable and the Bus button branch. Replace the ternary so all gaps just show "+ Add something" button(s):
- Gaps > 6 hours: dual buttons (top and bottom) -- already exists
- Gaps <= 6 hours: single centered button -- already exists
- Remove the transport-specific branch entirely

**13. Clean up lucide-react import (line 9):**
Remove `Bus`, `Magnet`, `Loader2` from the import. Keep `Plus`, `Lock`, `LockOpen`, `Trash2`.

## Files Modified
- `src/pages/Timeline.tsx` -- delete handleMagnetSnap, checkProximityAndPrompt, handleAddTransport, handleGenerateTransportDirect; remove prop passing
- `src/components/timeline/ContinuousTimeline.tsx` -- remove magnet state/buttons, transport gap button, unused imports and props

