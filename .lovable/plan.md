

# Overview Card — Condensed Layout + Review Cache

All changes in a single file: `src/components/timeline/PlaceOverview.tsx`

---

## 1. Add module-level review cache

Above the component definitions (around line 25), add:

```tsx
type CachedReview = { text: string; rating: number | null; author: string; relativeTime: string };
const reviewCache = new Map<string, CachedReview[]>();
```

## 2. Update review fetch effect (lines 193-209)

Replace with cache-first logic: check `reviewCache` by `google_place_id`, populate cache from preloaded or API results.

## 3. Time pill on hero images

After each hero image variant (lines 442-465), insert a time pill inside the `relative` container. The pill shows `"🕐 HH:MM — HH:MM [duration]"` with a frosted backdrop, positioned bottom-left. Only for non-flight entries with real scheduled times (not `2099`).

Three insertion points:
- Inside the images gallery div (line 443-450) -- add before closing `</div>`
- Inside the no-image editor fallback (line 462-464) -- add before closing `</div>`
- NOT on the flight fallback (flights have their own time layout)

The pill uses: `absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5`

## 4. Title row: name left, rating right (lines 531-545)

Wrap the current `<h2>` and add a rating display on the right side using flexbox. Rating pulled from `(option as any).rating` and `user_rating_count`.

```
Before: <h2>Title</h2>
After:  <div flex between>
          <h2>Title</h2>
          <span>⭐ 4.2 (3,139)</span>
        </div>
```

## 5. Replace time+map grid with info card+map grid (lines 852-931)

Remove the time card (left column) since time is now on the hero pill. Replace with a combined info card containing:
- Opening hours (collapsible, reusing same pattern as `PlaceDetailsSection`)
- Divider (if hours AND contact info exist)
- Phone link
- Website link
- "No details yet" placeholder for editors

Map column (right) stays identical.

## 6. Remove distance display (lines 934-939)

Delete the distance paragraph. Also remove the `distance` computed value (line 410-411) and the `haversineKm` import (line 12).

## 7. Replace PlaceDetailsSection render with closed-day warning only (lines 941-944)

The rating moved to the title row, hours moved to the info card. Keep only the closed-day conflict warning inline.

## 8. Remove old phone/website section (lines 1003-1044)

This content is now in the info card from step 5.

## 9. Streamline reviews (lines 970-1001)

Remove the header row ("Reviews (N)" + "See all on Google"). Keep just the scroll cards, then add a "See all reviews on Google" link below the scroll container.

---

## Technical detail: imports

- Remove `haversineKm` import (line 12)
- All other imports already present (`Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `ChevronDown`, `Phone`, `ExternalLink`, `AlertTriangle`, etc.)

## What stays unchanged

- Flight layout, transport layout, voting, budget, delete dialog, map popover, notes, ImageGallery, close button, editorial summary, modified hours warning

