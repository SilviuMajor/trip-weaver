

# Fixes: Day Indicator, Image Swipe, Consistent Fonts, Map Cleanup, Duration Pill

## Change 1: Day indicator in overview

Add a day label ("Day 3 · Wed 19 Feb") between the category badge and the title in EntrySheet.tsx view mode.

### EntrySheet.tsx (~line 1242-1244)
Compute `entryDayLabel` from `trip.start_date` and `entry.start_time`:
```typescript
const entryDayLabel = (() => {
  if (!trip?.start_date || !entry?.start_time) return null;
  const tripStart = new Date(trip.start_date + 'T00:00:00');
  const entryDate = new Date(entry.start_time);
  const diffDays = Math.floor((entryDate.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  const dayName = entryDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `Day ${diffDays + 1} · ${dayName}`;
})();
```

Insert between category badge and title (after line 1311, before line 1313):
```tsx
{entryDayLabel && (
  <p className="text-xs font-medium text-muted-foreground">{entryDayLabel}</p>
)}
```

## Change 2: ImageGallery -- touch swipe + fixed height

Replace `src/components/timeline/ImageGallery.tsx` entirely:
- Add `height` prop (default 220)
- Use `useRef` for touch tracking instead of state
- Replace `aspect-[16/9]` with fixed `height` style
- Swipe threshold: 50px

Then in EntrySheet.tsx, replace the inline hero image carousel (lines 1259-1294) with `<ImageGallery images={images} height={240} />` plus the existing ImageUploader overlay and swipe dots. The hero section becomes:
```tsx
{images.length > 0 ? (
  <div className="relative w-full overflow-hidden" style={{ height: 240 }}>
    <ImageGallery images={images} height={240} />
    {isEditor && option.category !== 'transfer' && (
      <div className="absolute bottom-3 right-3 z-30">
        <ImageUploader optionId={option.id} currentCount={images.length} onUploaded={onSaved} />
      </div>
    )}
  </div>
) : isEditor && option.category !== 'transfer' ? (
  <div className="w-full bg-muted/30 flex items-center justify-center" style={{ height: 160 }}>
    <ImageUploader optionId={option.id} currentCount={0} onUploaded={onSaved} />
  </div>
) : null}
```

Note: The ImageGallery already has its own dots and arrows internally, so we remove the duplicate inline arrows/dots from EntrySheet.

## Change 3: Consistent font sizes across card tiers

In EntryCard.tsx, the Full tier (lines 635-637) uses `text-lg` for the title while Condensed uses `text-sm`. Change Full tier title from `text-lg` to `text-sm font-bold` to match Condensed. Both image-card tiers should use:
- Title: `text-sm font-bold`
- Rating/location/notes/time: `text-[10px]`

Only change needed: line 636 -- change `text-lg` to `text-sm`.

## Change 4: MapPreview -- just the map image with popover

Replace `src/components/timeline/MapPreview.tsx` with a simplified version:
- Remove `locationName` text above the map
- Remove the 3-button stack below the map
- Map image is wrapped in a Popover trigger
- Tapping opens a popover with 3 nav choices (Apple Maps, Google Maps, Uber) using emoji prefixes
- If image fails to load, return null

## Change 5: Duration as styled pill in time box

In EntrySheet.tsx view mode, the time card (lines 1694-1704) shows duration as `text-lg font-extrabold text-primary`. Replace with a pill:

```tsx
<span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary mt-1">
  {durationString}
</span>
```

Also remove the Lock icon from inside the time box (line 1704) -- it's already shown elsewhere.

## Files Modified

| File | Scope |
|------|-------|
| `src/components/timeline/EntrySheet.tsx` | Day label, hero uses ImageGallery, duration pill in time box |
| `src/components/timeline/EntryCard.tsx` | Full tier title text-lg to text-sm |
| `src/components/timeline/ImageGallery.tsx` | Full rewrite: touch swipe, fixed height prop |
| `src/components/timeline/MapPreview.tsx` | Full rewrite: map-only with popover nav |

