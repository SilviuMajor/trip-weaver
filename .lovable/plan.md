
# Hotfix: Reviews Overflow Breaking Layout

Two small CSS fixes in `src/components/timeline/PlaceOverview.tsx`:

### Fix 1 — Remove negative margins from reviews scroll
**Line 975**: Remove `-mx-4 px-4` from the reviews horizontal scroll container. These negative margins extend beyond the Dialog/Drawer boundary, causing layout overflow.

### Fix 2 — Add overflow-x-hidden safety net
**Line 458**: Add `overflow-x-hidden` to the main content wrapper `div` so any future overflowing content is clipped.

### Technical details
- **File:** `src/components/timeline/PlaceOverview.tsx`
- **Line 975:** Change `className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4"` to `className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none"`
- **Line 458:** Change `className="px-4 pb-4 pt-2 space-y-4"` to `className="px-4 pb-4 pt-2 space-y-4 overflow-x-hidden"`
