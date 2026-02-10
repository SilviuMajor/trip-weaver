

# Entry Creation: Image Picker + Merged Form

## Overview

Three changes to the entry creation flow:

1. **Show Google Places photos** in the creation form as a horizontal scrollable strip with select/delete and drag-to-reorder
2. **Merge the "When" step** into the "Details" step, making it a single scrollable page
3. First image in the strip becomes the **cover photo** for the entry card

---

## 1. Image Picker Strip

### Behavior

- When the user types a place name and selects from autocomplete, `handlePlaceSelect` currently stores photos in `autoPhotos` (string array of URLs)
- After photos load, show a **horizontal scroll strip** of thumbnails below the name field
- Each thumbnail:
  - Shows a checkmark overlay when selected (all are selected by default)
  - Tap the **X** button to deselect/delete a photo (removes it from the array)
  - First image in the strip = cover photo, indicated with a small "Cover" badge
- **Drag to reorder**: users can drag thumbnails left/right to change order. The leftmost image becomes the cover.
- Only selected (remaining) photos are saved to `option_images` on submit
- Does NOT apply to flights or transfers (they use plain `Input`, not `PlacesAutocomplete`)
- A loading spinner shows while photos are being fetched (use existing `fetchingDetails` state from PlacesAutocomplete)

### Implementation

**New file: `src/components/timeline/PhotoStripPicker.tsx`**

A self-contained component that:
- Accepts `photos: string[]` and `onChange: (photos: string[]) => void`
- Renders a horizontal scrollable row of image thumbnails (fixed height ~80px, aspect ratio preserved)
- Each thumbnail has an X button (top-right) to remove
- First thumbnail gets a "Cover" badge (bottom-left)
- Supports drag-to-reorder using native HTML drag events (`draggable`, `onDragStart`, `onDragOver`, `onDrop`)
- Smooth reorder animation with a visual drop indicator

**File: `src/components/timeline/EntryForm.tsx`**

- Import `PhotoStripPicker`
- In the details step (line ~731, after the PlacesAutocomplete field), render:
  ```
  {autoPhotos.length > 0 && !isFlight && !isTransfer && (
    <PhotoStripPicker photos={autoPhotos} onChange={setAutoPhotos} />
  )}
  ```
- The existing save logic (lines 516-542) already uploads `autoPhotos` to storage -- no change needed there, it will just upload whatever photos remain in the array after user selection

---

## 2. Merge "When" into "Details" (Single Scrollable Page)

### Current flow
- Step 1: Category picker (grid of emoji buttons)
- Step 2: Details (name, website, location, etc.) with "Next: When?" button
- Step 3: When (day/date, time, duration) with "Create Entry" button

### New flow
- Step 1: Category picker (unchanged)
- Step 2: Details + When (single scrollable page)
  - Top: Category badge, name field, photo strip, website, location
  - Divider or subtle section header: "When"
  - Day/date picker, time inputs, duration
  - Footer: "Back" | "Add to Ideas" | "Create Entry"

### Implementation

**File: `src/components/timeline/EntryForm.tsx`**

- Remove the `'when'` step entirely from the `Step` type -- change to `type Step = 'category' | 'details'`
- Remove `handleDetailsNext` function (no longer needed)
- In the `step === 'details'` block (lines 717-907):
  - Keep all existing details fields
  - After the location/website fields, add a subtle separator: `<div className="border-t border-border/50 pt-4 mt-2"><Label className="text-sm font-semibold text-muted-foreground">When</Label></div>`
  - Paste in the "when" content (currently lines 910-1026): day/date picker, time inputs, duration
  - Update the footer to show all three buttons: "Back" (to category), "Add to Ideas", "Create Entry"
- Remove the `step === 'when'` block entirely (lines 909-1027)
- The dialog already has `max-h-[90vh] overflow-y-auto` so scrolling works automatically

---

## File Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/timeline/PhotoStripPicker.tsx` | **New** | Horizontal drag-to-reorder photo strip with delete and cover badge |
| `src/components/timeline/EntryForm.tsx` | Edit | Add photo strip after name field; merge "when" step into "details" step; remove step 3 |

No database changes. No edge function changes.

---

## Technical Details

### PhotoStripPicker component structure

```text
Props:
  photos: string[]        -- ordered array of image URLs
  onChange: (p: string[]) => void  -- called when order changes or photo removed

State:
  dragIndex: number | null  -- index being dragged

Render:
  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
    {photos.map((url, i) => (
      <div
        key={url}
        draggable
        onDragStart={() => setDragIndex(i)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleReorder(dragIndex, i)}
        className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 cursor-grab
                   {dragIndex === i ? 'opacity-50' : ''} 
                   {i === 0 ? 'border-primary' : 'border-border'}"
      >
        <img src={url} className="w-full h-full object-cover" />
        {i === 0 && <span className="absolute bottom-0 left-0 bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-tr-md font-medium">Cover</span>}
        <button onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
          <X className="h-3 w-3 text-white" />
        </button>
      </div>
    ))}
  </div>

handleReorder(from, to):
  const copy = [...photos]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  onChange(copy)

removePhoto(index):
  onChange(photos.filter((_, i) => i !== index))
```

### Merged form layout

```text
+----------------------------------+
| [category badge] <- change       |
|                                  |
| Name *                           |
| [PlacesAutocomplete input]       |
|                                  |
| [photo1] [photo2] [photo3] -->   |  <- horizontal scroll strip
|  Cover                           |
|                                  |
| Website                          |
| [input]                          |
|                                  |
| Location Name                    |
| [input]                          |
|                                  |
| -------- When --------           |  <- subtle divider
|                                  |
| Day / Date                       |
| [day picker or date input]       |
|                                  |
| Time         Suggested: 09:00... |
| [Start]      [End]               |
|                                  |
| Duration (minutes)               |
| [input]                          |
|                                  |
| [Back] [Add to Ideas] [Create]   |
+----------------------------------+
```

