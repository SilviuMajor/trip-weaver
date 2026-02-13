

# Rename Uber Buttons to Match Map Button Style

## What Changes

All Uber buttons (in `RouteMapPreview.tsx` and `EntrySheet.tsx`) will be restyled to match the Apple Maps / Google Maps buttons -- compact outline style with just icon + "Uber" + external link icon.

### RouteMapPreview.tsx (line 116-122)

Move the Uber button into the same `flex gap-2` row as Apple Maps and Google Maps, making it a third equal button:

```tsx
<div className="flex gap-2">
  <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
    <a href={appleMapsUrl} ...><Navigation className="mr-1 h-3 w-3" />Apple Maps</a>
  </Button>
  <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
    <a href={googleMapsUrl} ...><ExternalLink className="mr-1 h-3 w-3" />Google Maps</a>
  </Button>
  {uberUrl && (
    <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
      <a href={uberUrl} ...><Car className="mr-1 h-3 w-3" />Uber<ExternalLink className="ml-1 h-3 w-3" /></a>
    </Button>
  )}
</div>
```

- Same `variant="outline"` and `size="sm"` as the other buttons
- Icon (Car) + "Uber" + ExternalLink arrow (matching Google Maps style)
- No more separate row or black background

### EntrySheet.tsx (lines 1644-1656)

Same treatment for the regular event Uber button -- change from full-width black to outline style with icon + "Uber" + external link icon:

```tsx
<Button variant="outline" size="sm" className="w-full text-xs" asChild>
  <a href={...} ...>
    <Car className="mr-1 h-3 w-3" /> Uber <ExternalLink className="ml-1 h-3 w-3" />
  </a>
</Button>
```

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/RouteMapPreview.tsx` | Move Uber into button row, outline style, icon + "Uber" + ExternalLink |
| `src/components/timeline/EntrySheet.tsx` | Same style change for regular event Uber button |

