

# Fix Double Uber Buttons + Hotel Card Height

## Bug B1: Remove duplicate map links in EntrySheet

### Changes to `src/components/timeline/EntrySheet.tsx`

**a) Remove standalone "Open in Google Maps" link (lines 1653-1663)**

Delete the `{(option as any).google_maps_uri && ...}` block that renders the `<a>` with MapPinIcon text link. MapPreview already has a Google Maps button.

**b) Remove standalone Uber button (lines 1667-1679)**

Delete the entire `{option.category !== 'transfer' && ...}` block that renders the black Uber `<Button>`. MapPreview already provides an Uber button.

### Changes to `src/components/timeline/MapPreview.tsx`

**c) Style the Uber button with black/white branding**

Change the Uber button from `variant="outline"` to include `bg-black text-white hover:bg-black/90 border-black` classes.

**d) Change button layout to two rows**

Wrap Apple Maps and Google Maps in a `flex gap-2` row (side by side, half width each), then put Uber on its own full-width row below:

```
<div className="space-y-2">
  <div className="flex gap-2">
    <!-- Apple Maps (flex-1) -->
    <!-- Google Maps (flex-1) -->
  </div>
  <!-- Uber (full width, black bg) -->
</div>
```

**e) RouteMapPreview verification**

RouteMapPreview is only used inside EntryCard for transport entries and inside EntrySheet for transport overviews. MapPreview is used for non-transport entries. These don't overlap -- no changes needed to RouteMapPreview.

---

## Bug B2: Hotel check-in/checkout cards too tall

### Root cause

`PIXELS_PER_HOUR = 80` means a 1-hour check-in = 80px, which triggers the "condensed" layout (80-160px range). This layout includes category badge, title, time range, duration, distance, rating, and vote button -- quite a lot of content for a simple hotel check-in.

### Changes to `src/components/timeline/EntryCard.tsx`

In the condensed layout section (starting around line 522), add a check: if the option name starts with "Check in ·" or "Check out ·", render a simplified/compact variant:

- Skip the category badge row
- Use smaller font for the name (text-xs instead of text-sm)
- Skip rating/distance/vote displays
- Reduce vertical padding (py-1 instead of py-1.5)
- This makes these specific hotel utility blocks visually lighter while still being proportional to their duration

The check:
```tsx
const isHotelUtilityBlock = option.name?.startsWith('Check in ·') || option.name?.startsWith('Check out ·');
```

If `isCondensed && isHotelUtilityBlock`, render a minimal card with just the emoji + name + time range, similar to the `isMedium` layout but fitting the condensed height.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/EntrySheet.tsx` | Remove standalone Google Maps link and Uber button (lines 1653-1679) |
| `src/components/timeline/MapPreview.tsx` | Uber button black styling, two-row layout |
| `src/components/timeline/EntryCard.tsx` | Compact rendering for hotel check-in/checkout blocks in condensed layout |

## What Does NOT Change

- RouteMapPreview.tsx (transport maps -- already correct)
- HotelWizard, flight systems, transport connectors
- Timeline rendering logic (PIXELS_PER_HOUR, height calculations)
- ContinuousTimeline.tsx

