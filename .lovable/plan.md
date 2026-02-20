
# Fix: Overview Close Button + Mobile Full-Screen

## 1. Add Close Button to PlaceOverview

**File:** `src/components/timeline/PlaceOverview.tsx`

- Add `X` to the lucide-react import (line 14)
- Insert a close button before the hero image section (line 430-432), positioned `absolute top-3 right-3 z-50` with a dark translucent circle (`bg-black/40 backdrop-blur-sm`), calling `onClose`

## 2. Hide Default Dialog X on Desktop View Mode

**File:** `src/components/timeline/EntrySheet.tsx`

- Add `[&>button:last-child]:hidden` to the view-mode `DialogContent` class (line 908) to suppress the duplicate shadcn close button

## 3. Mobile Full-Screen Overlay

**File:** `src/components/timeline/EntrySheet.tsx`

- Replace the mobile Drawer wrapper (lines 896-904) with a plain `div` full-screen overlay:
  - `fixed inset-0 z-50 bg-background overflow-y-auto overscroll-none`
  - Returns `null` when `!open`
  - No drag handle, no slide-up animation, no pull-to-dismiss
  - Close via the X button added in PlaceOverview
- The `Drawer`/`DrawerContent` import on line 3 can be removed if not used by create mode (need to verify -- if create mode uses it on mobile, keep the import)

### Technical Details

**PlaceOverview.tsx line 14** -- add `X` to imports:
```tsx
import { ..., AlertTriangle, X } from 'lucide-react';
```

**PlaceOverview.tsx lines 430-432** -- insert close button before hero:
```tsx
return (
  <>
    {/* Close button */}
    <button
      className="absolute top-3 right-3 z-50 flex items-center justify-center h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
      onClick={onClose}
      aria-label="Close"
    >
      <X className="h-4 w-4 text-white" />
    </button>

    {/* Hero image gallery at top ... */}
```

**EntrySheet.tsx line 908** -- hide default X:
```tsx
<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md p-0 [&>button:last-child]:hidden">
```

**EntrySheet.tsx lines 896-904** -- full-screen overlay:
```tsx
if (isMobile) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto overscroll-none">
      <div className="relative min-h-full">
        {viewContent}
      </div>
    </div>
  );
}
```

### Files Changed
| File | Change |
|------|--------|
| `src/components/timeline/PlaceOverview.tsx` | Add `X` import, add close button over hero |
| `src/components/timeline/EntrySheet.tsx` | Hide default Dialog X, replace mobile Drawer with full-screen overlay |
