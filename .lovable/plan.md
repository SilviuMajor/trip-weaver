
# Improve Flight View in EntrySheet

## Changes

### 1. Hide website field for flights (line 1263)

Currently the website field is shown for all non-transfer categories including flights. Add `option.category !== 'flight'` to the condition so it's hidden for flights too.

**Line 1263**: Change `option.category !== 'transfer'` to `option.category !== 'transfer' && option.category !== 'flight'`

### 2. Add default plane image for flights

When a flight entry has no uploaded images, show a default airplane photo as a hero banner above the flight details. Use a high-quality Unsplash placeholder URL for an airplane/sky image.

- Add a conditional block before the flight layout (around line 980) that shows a banner image when `images.length === 0` and the entry is a flight
- Use a static Unsplash image URL: `https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=600&h=200&fit=crop` (plane wing above clouds)
- Rendered as a rounded banner: `<img className="w-full h-32 object-cover rounded-xl" />`

### 3. Restructure Airport Processing section (lines 1052-1084)

Replace the current loosely-styled inline fields with proper labeled Input fields in a clean grid layout:

```
Airport Processing
┌─────────────────────┬──────────────────────┐
│ Check-in            │ Checkout             │
│ [2] hrs before      │ [30] mins after      │
└─────────────────────┴──────────────────────┘
```

- Use proper `<Input type="number">` fields instead of `InlineField` for better structure
- Add unit suffixes ("hrs before" / "mins after") as trailing text
- Use controlled local state that saves on blur

### 4. Format terminal display as "Terminal - 5" (lines 990-996, 1022-1028)

Update the terminal `renderDisplay` to format values like "Terminal - 5" when the stored value is just "5" or "T5":

- In `renderDisplay` for both departure and arrival terminals, prefix with "Terminal - " if the value is a short number/code
- Keep the edit input as-is so users can type freely
- Show "Add terminal" placeholder when empty (as now)

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/EntrySheet.tsx` | Hide website for flights; add default plane image; restructure airport processing with Input fields; format terminal display |
