
# "Send to Planner", Remove Inline Title Edit, Bigger Close Button, Lock Toggle in Overview

## 1. Rename "Move to Ideas" to "Send to Planner"

**File: `src/components/timeline/EntrySheet.tsx`**

- Line 1462-1465: Change the button text from "Move to ideas" to "Send to Planner", replace `Lightbulb` icon with `ClipboardList` icon (import it from lucide-react)
- Also hide for flights: add `option?.category !== 'flight'` to the existing condition

**File: `src/pages/Timeline.tsx`**

- Line 1021: Rename comment from "Move to ideas" to "Send to Planner"
- Line 1032: Change toast message from `'Moved to ideas panel'` to `'Event moved to Planner'`, and add an Undo action to the toast that re-schedules the entry (sets `is_scheduled: true`)

**File: `src/lib/conflictEngine.ts`**

- Line 146: Change description from `'Move to ideas (unscheduled)'` to `'Send to Planner (unscheduled)'`

## 2. Remove Inline Title Editing on Timeline Cards

**File: `src/components/timeline/EntryCard.tsx`**

Remove the inline editing functionality for the title on all card variants (full, condensed, medium, compact):
- Remove the `isEditingName`, `editedName`, `nameInputRef` state variables and the `handleNameClick`, `handleNameSave`, `handleNameKeyDown` functions (lines 130-168)
- In each card variant, replace the conditional `isEditingName ? <input>... : <span onClick={handleNameClick}>` with just a plain display `<span>` or `<h3>` (no `onClick`, no `cursor-text`)
- Affects: compact card (lines 564-581), medium card (lines 498-515), condensed card (lines 636-653), full card (lines 773-803)

## 3. Bigger Close Button on Overview Sheet

**File: `src/components/timeline/EntrySheet.tsx`**

The Dialog uses shadcn's `DialogContent` which includes an auto-generated close button. Override it by adding a custom close button in the view mode dialog:

- In the view mode `DialogContent` (line 1025), add a custom X button at the top-right with `h-11 w-11` (44x44px tap target) and hide the default close button using the `hideCloseButton` approach or by overriding styling
- Position: `absolute top-3 right-3 z-50`, with a larger X icon (`h-6 w-6`)

Since shadcn's `DialogContent` has a built-in close button that is small, we need to either:
- Add `className` to DialogContent to hide the default close via CSS (`[&>button]:hidden`) and render our own larger close button
- Or override the close button styling directly

Approach: Add `[&>button.absolute]:h-11 [&>button.absolute]:w-11` to the DialogContent className to increase the built-in close button's tap target, or render a custom one.

Simplest: Override the default close button in DialogContent with CSS: `className="... [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:top-3 [&>button:last-child]:right-3 [&>button:last-child]:[&_svg]:h-6 [&>button:last-child]:[&_svg]:w-6"`

## 4. Lock Toggle in Overview Sheet (Top-Right, Beside X)

**File: `src/components/timeline/EntrySheet.tsx`**

- In the view mode dialog header area (around line 1026-1045), add a lock/unlock icon button beside the close button in the top-right area
- Locked: solid orange filled `Lock` icon (`text-primary fill-primary`)
- Unlocked: grey outline `LockOpen` icon (`text-muted-foreground`)
- Do NOT show on flight overviews (`option.category === 'flight'`) or transport overviews (`option.category === 'transfer'`)
- Tapping calls the existing `handleToggleLock` function
- Remove the existing Lock/Unlock button from the editor actions row (lines 1458-1460) since it's now redundant

Position the lock icon as `absolute top-3 right-14` (to the left of the close X button).

## 5. Undo Toast for "Send to Planner"

**File: `src/pages/Timeline.tsx`**

Update `handleMoveToIdeas` (to be renamed `handleSendToPlanner`):
- After successfully unscheduling, show a toast with an "Undo" action button
- The Undo action sets `is_scheduled: true` on the entry and calls `fetchData()`

## Summary of File Changes

| File | Change |
|---|---|
| `src/components/timeline/EntrySheet.tsx` | Rename button to "Send to Planner" with ClipboardList icon, bigger close button, add lock toggle top-right, remove redundant lock button from actions row, hide "Send to Planner" on flights |
| `src/components/timeline/EntryCard.tsx` | Remove all inline title editing (state, handlers, conditional inputs) -- titles are display-only |
| `src/pages/Timeline.tsx` | Rename handler/toast, add undo toast action for "Send to Planner" |
| `src/lib/conflictEngine.ts` | Rename description text |

## Technical Notes

- The lock toggle in the overview uses `absolute top-3 right-14 z-50` positioning inside `DialogContent` (which is `relative`)
- Close button enlarged to 44x44px via CSS overrides on DialogContent's built-in close button
- Undo toast uses the toast action pattern: `toast({ title: '...', action: <ToastAction onClick={...}>Undo</ToastAction> })`
- Inline title editing removal is purely a deletion -- no new code needed, just remove the editing states and replace conditional renders with plain text elements
