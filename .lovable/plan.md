

# Remaining Fixes: Flight Bar Tint, EntryCard Duration Behavior, Map Cleanup

## Change 1: FlightGroupCard.tsx -- Background tint on check-in/checkout bars

The check-in and checkout bar containers (lines 93-94 and 183-184) currently have no background color. Add a subtle ~20% opacity tint using the category color.

### Lines 93-95
Add `backgroundColor: \`\${catColor}33\`` to the style object of the check-in container div.

### Lines 183-185
Same for the checkout container div.

## Change 2: EntryCard.tsx -- Duration-based layout behavior

Compute entry duration in minutes. Behavior changes at two thresholds:

### Duration > 45 min (current behavior, mostly unchanged)
- Text bottom-right (justify-end), pill top-right -- different vertical zones
- Card uses overflow-hidden (default)
- No extra padding-right needed on content

### Duration <= 45 min ("compact image" mode)
- Card wrapper: `overflow: visible` instead of `overflow-hidden`
- Both text AND pill vertically centered
- Pill: `top: 50%, transform: translateY(-50%), right: 5px` instead of fixed top
- Content: absolutely positioned with `top: 50%, left: 10px, right: 54px, transform: translateY(-50%), textAlign: right, zIndex: 10`
- This means if the card height is shorter than the text, the text visibly overflows -- it is never clipped

### Duration <= 20 min ("micro" mode, subset of <= 45min)
- Corner flag becomes a centered circle pill on the left: `left: 5, top: 50%, transform: translateY(-50%), borderRadius: 999px` instead of pinned top-left with `borderRadius: 14px 0 8px 0`

### Implementation in EntryCard.tsx

Add duration computation near line 156:
```typescript
const durationMin = Math.round(
  (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
);
const isShortEntry = durationMin <= 45;
const isMicroEntry = durationMin <= 20;
```

Modify `cardBase` function (line 502) to accept an `overflowVisible` parameter. When true, add `overflow-visible` class instead of `overflow-hidden`.

Modify `cornerFlag` function (line 328) to accept the `isMicro` flag and adjust positioning.

Modify Condensed and Full tier renders to use the short-entry layout when `isShortEntry` is true.

## Change 3: EntrySheet.tsx -- Map cleanup

Remove the `location_name` text above the map image (lines 1696-1698) and the "Open in Maps ->" text below (line 1705). Keep just the map image as the popover trigger.

### Lines 1694-1706
Replace with a cleaner version: just the `<img>` inside the PopoverTrigger, no text above or below, with rounded-xl overflow-hidden styling.

## Files Modified

| File | Change |
|------|--------|
| FlightGroupCard.tsx | Add backgroundColor tint to check-in/checkout containers |
| EntryCard.tsx | Duration-based layout: overflow-visible + centered for short entries, micro corner flag |
| EntrySheet.tsx | Remove location text and "Open in Maps" from map cell |

